import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, appUrl, stripeConfigurado } from '@/lib/stripe'

// Abre el Billing Portal de Stripe para que el dueño cambie su tarjeta, vea sus
// recibos o cancele. Solo el dueño con un customer de Stripe ya creado.
export async function POST() {
  if (!stripeConfigurado() || !stripe) {
    return NextResponse.json({ error: 'Stripe no está configurado.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data: negocio } = await supabase
    .from('negocios')
    .select('stripe_customer_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!negocio?.stripe_customer_id) {
    return NextResponse.json({ error: 'Aún no tienes una suscripción.' }, { status: 403 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: negocio.stripe_customer_id,
    return_url: `${appUrl()}/suscripcion`,
  })

  return NextResponse.json({ url: session.url })
}
