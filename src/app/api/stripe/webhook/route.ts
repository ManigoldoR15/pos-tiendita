import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'

// Webhook de Stripe: la ÚNICA fuente de verdad del estado de la suscripción.
// Verifica la firma con STRIPE_WEBHOOK_SECRET y actualiza el negocio con el
// service client (bypasa RLS y el trigger de campos admin de la 069).
// Excluido del middleware (ver matcher en proxy.ts) para que Stripe no reciba
// un redirect a /login.

// Fecha YYYY-MM-DD en México desde un timestamp unix (segundos).
function fechaMX(unixSeconds: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })
    .format(new Date(unixSeconds * 1000))
}

// El fin del periodo migró a nivel de item en versiones recientes de la API;
// lo leemos de forma defensiva desde ambos lugares.
function periodoFin(sub: Stripe.Subscription): number | null {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end
  return top ?? sub.items?.data?.[0]?.current_period_end ?? null
}

type UpdateNegocio = {
  stripe_status: string
  stripe_subscription_id?: string
  suscripcion_fin?: string
  plan?: string
}

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe no configurado.' }, { status: 503 })
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret ausente.' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Sin firma.' }, { status: 400 })
  }

  const payload = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'firma inválida'
    return NextResponse.json({ error: `Firma inválida: ${msg}` }, { status: 400 })
  }

  const admin = createServiceClient()

  async function aplicarSubscripcion(sub: Stripe.Subscription) {
    const patch: UpdateNegocio = { stripe_status: sub.status, stripe_subscription_id: sub.id }
    const fin = periodoFin(sub)
    if (fin) patch.suscripcion_fin = fechaMX(fin)
    // Una vez suscrito, el plan queda como 'mensual' para el panel del superadmin.
    if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') {
      patch.plan = 'mensual'
    }
    await admin.from('negocios').update(patch).eq('stripe_customer_id', sub.customer as string)
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const negocioId = session.client_reference_id
      const customerId = session.customer as string | null
      if (negocioId && customerId) {
        // Vincula el customer al negocio por si no se guardó en el checkout.
        await admin.from('negocios').update({ stripe_customer_id: customerId }).eq('id', negocioId)
      }
      if (session.subscription && customerId) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        await aplicarSubscripcion(sub)
      }
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await aplicarSubscripcion(event.data.object as Stripe.Subscription)
      break
    }

    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      if (invoice.amount_paid > 0) {
        const { data: negocio } = await admin
          .from('negocios').select('id').eq('stripe_customer_id', customerId).maybeSingle()
        if (negocio) {
          const linea = invoice.lines?.data?.[0]
          const ini = linea?.period?.start ? fechaMX(linea.period.start) : null
          const fin = linea?.period?.end ? fechaMX(linea.period.end) : null
          await admin.from('pagos_suscripcion').insert({
            negocio_id:     negocio.id,
            fecha_pago:     fechaMX(invoice.created),
            monto:          invoice.amount_paid,
            plan:           'mensual',
            periodo_inicio: ini,
            periodo_fin:    fin,
            metodo:         'stripe',
            notas:          `Stripe invoice ${invoice.id}`,
          })
          if (fin) {
            await admin.from('negocios').update({ suscripcion_fin: fin }).eq('id', negocio.id)
          }
        }
      }
      break
    }

    default:
      // Otros eventos: se ignoran silenciosamente (Stripe reintenta solo los 5xx).
      break
  }

  return NextResponse.json({ received: true })
}
