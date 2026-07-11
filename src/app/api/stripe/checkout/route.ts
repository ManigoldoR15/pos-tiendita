import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, STRIPE_PRICE_ID, appUrl, stripeConfigurado } from '@/lib/stripe'
import { TRIAL_DIAS } from '@/lib/suscripcion'

// Inicia la suscripción: crea (o reutiliza) el customer de Stripe del negocio y
// abre una sesión de Checkout en modo suscripción con 14 días de prueba.
// Solo el DUEÑO del negocio puede suscribir. Devuelve la URL de Stripe.
export async function POST() {
  if (!stripeConfigurado() || !stripe) {
    return NextResponse.json({ error: 'Stripe no está configurado.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  // Solo el dueño (owner_id) suscribe — no un empleado ni otro miembro.
  const { data: negocio } = await supabase
    .from('negocios')
    .select('id, nombre, stripe_customer_id, stripe_status')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!negocio) {
    return NextResponse.json({ error: 'Solo el dueño puede suscribir el negocio.' }, { status: 403 })
  }
  if (negocio.stripe_status === 'active' || negocio.stripe_status === 'trialing') {
    return NextResponse.json({ error: 'La suscripción ya está activa.' }, { status: 409 })
  }

  // Reutilizar el customer si ya existe; si no, crearlo y guardarlo con el
  // service client (el trigger de la 069 no deja al dueño escribir stripe_*).
  let customerId = negocio.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: negocio.nombre,
      metadata: { negocio_id: negocio.id },
    })
    customerId = customer.id
    const admin = createServiceClient()
    await admin.from('negocios').update({ stripe_customer_id: customerId }).eq('id', negocio.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: negocio.id,
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DIAS,
      metadata: { negocio_id: negocio.id },
    },
    success_url: `${appUrl()}/suscripcion?estado=exito`,
    cancel_url: `${appUrl()}/suscripcion?estado=cancelado`,
    locale: 'es-419',
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
