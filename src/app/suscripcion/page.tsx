import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaCorta } from '@/lib/fecha'
import { stripe, STRIPE_PRICE_ID, stripeConfigurado } from '@/lib/stripe'
import { estadoSuscripcion, ETIQUETA_ESTADO, TRIAL_DIAS } from '@/lib/suscripcion'
import SuscripcionAcciones from './acciones'

const TONOS: Record<string, string> = {
  verde: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  azul:  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  ambar: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  rojo:  'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  gris:  'bg-muted text-muted-foreground',
}

export default async function SuscripcionPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  const esDueno = rol === 'dueno'
  const estado = estadoSuscripcion(negocio)
  const etiqueta = ETIQUETA_ESTADO[estado]
  const { estado: param } = await searchParams

  // Precio mostrado: se lee directo de Stripe para no duplicar el número.
  let precioTexto = '—'
  if (stripeConfigurado() && stripe) {
    try {
      const price = await stripe.prices.retrieve(STRIPE_PRICE_ID)
      if (price.unit_amount) precioTexto = `${formatMXN(price.unit_amount)}/mes`
    } catch {
      /* precio no disponible: se muestra '—' */
    }
  }

  const yaSuscrito = estado === 'activa' || estado === 'prueba' || estado === 'gracia'

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight">Suscripción</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TONOS[etiqueta.tono]}`}>
            {etiqueta.label}
          </span>
        </div>

        {param === 'exito' && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
            ¡Listo! Tu suscripción quedó activa. Puede tardar unos segundos en reflejarse.
          </div>
        )}
        {param === 'cancelado' && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
            No se completó el pago. Puedes intentarlo cuando quieras.
          </div>
        )}

        <div className="card-soft space-y-4 p-6">
          <div>
            <p className="text-sm text-muted-foreground">Negocio</p>
            <p className="text-lg font-bold">{negocio.nombre}</p>
          </div>

          {estado === 'vencida' || estado === 'cancelada' ? (
            <p className="text-sm text-muted-foreground">
              Tu suscripción no está activa, por eso el acceso al sistema está en pausa.
              Reactívala para seguir usando el punto de venta.
            </p>
          ) : estado === 'gracia' ? (
            <p className="text-sm text-muted-foreground">
              Tu último pago no se pudo cobrar. Tienes unos días de gracia; actualiza tu
              tarjeta para no perder el acceso.
            </p>
          ) : estado === 'prueba' ? (
            <p className="text-sm text-muted-foreground">
              Estás en tu prueba gratis{negocio.suscripcion_fin ? ` hasta el ${fmtFechaCorta(negocio.suscripcion_fin)}` : ''}.
              El primer cobro se hace al terminar la prueba.
            </p>
          ) : estado === 'activa' ? (
            <p className="text-sm text-muted-foreground">
              Suscripción al corriente{negocio.suscripcion_fin ? ` · próximo cobro el ${fmtFechaCorta(negocio.suscripcion_fin)}` : ''}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Suscríbete para usar el punto de venta con reportes, respaldos y todas las
              funciones. Incluye {TRIAL_DIAS} días de prueba gratis — no se te cobra hasta
              terminar la prueba.
            </p>
          )}

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black">{precioTexto}</span>
          </div>

          {esDueno ? (
            <SuscripcionAcciones yaSuscrito={yaSuscrito} configurado={stripeConfigurado()} />
          ) : (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Solo el dueño del negocio puede administrar la suscripción. Pídele que
              actualice el pago desde su cuenta.
            </p>
          )}
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
