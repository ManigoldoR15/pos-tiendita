import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle, Clock, Printer, TrendingUp, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { cn } from '@/lib/utils'
import FormAbrirCorte from './form-abrir'
import FormCerrarCorte from './form-cerrar'

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function CortePage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()

  // Corte abierto
  const { data: corteAbierto } = await supabase
    .from('cortes_caja')
    .select('id, monto_inicial, fecha_apertura')
    .eq('negocio_id', negocio.id)
    .eq('estado', 'abierto')
    .maybeSingle()

  // Último corte cerrado (para mostrar resumen)
  const { data: ultimoCerrado } = await supabase
    .from('cortes_caja')
    .select('id, monto_inicial, fecha_apertura, fecha_cierre, monto_esperado, monto_contado, diferencia')
    .eq('negocio_id', negocio.id)
    .eq('estado', 'cerrado')
    .order('fecha_cierre', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Método de pago Efectivo del negocio
  const { data: metodoPagoEfectivo } = await supabase
    .from('metodos_pago')
    .select('id')
    .eq('negocio_id', negocio.id)
    .ilike('nombre', 'efectivo')
    .maybeSingle()

  // Si hay corte abierto, cargar sus ventas
  let totalVentas = 0
  let numVentas = 0
  let ventasEfectivo = 0
  let montoEsperado = 0

  if (corteAbierto) {
    const { data: ventas } = await supabase
      .from('ventas')
      .select('total, metodo_pago_id')
      .eq('corte_id', corteAbierto.id)
      .eq('estado', 'completada')

    totalVentas = ventas?.reduce((s, v) => s + v.total, 0) ?? 0
    numVentas = ventas?.length ?? 0
    ventasEfectivo =
      ventas
        ?.filter((v) => v.metodo_pago_id === metodoPagoEfectivo?.id)
        .reduce((s, v) => s + v.total, 0) ?? 0
    montoEsperado = corteAbierto.monto_inicial + ventasEfectivo
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Corte de caja</h1>

      {corteAbierto ? (
        /* ── CAJA ABIERTA ── */
        <div className="space-y-4">
          {/* Estado */}
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-semibold text-green-700">Caja abierta</span>
            <span className="ml-auto text-xs text-green-600">{fmtFecha(corteAbierto.fecha_apertura)}</span>
          </div>

          {/* Resumen del turno */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCorte
              label="Fondo inicial"
              value={formatMXN(corteAbierto.monto_inicial)}
              icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
            />
            <KpiCorte
              label="Ventas del turno"
              value={formatMXN(totalVentas)}
              sub={`${numVentas} ${numVentas === 1 ? 'venta' : 'ventas'}`}
              icon={<TrendingUp className="h-4 w-4 text-green-600" />}
            />
            <KpiCorte
              label="En efectivo"
              value={formatMXN(ventasEfectivo)}
              icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
            />
            <KpiCorte
              label="Otros métodos"
              value={formatMXN(totalVentas - ventasEfectivo)}
              icon={<TrendingUp className="h-4 w-4 text-purple-600" />}
            />
          </div>

          {/* Formulario de cierre */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold">Cerrar caja</h2>
            <FormCerrarCorte
              corteId={corteAbierto.id}
              montoEsperado={montoEsperado}
            />
          </div>
        </div>
      ) : (
        /* ── CAJA CERRADA ── */
        <div className="space-y-4">
          {/* Resumen del último corte */}
          {ultimoCerrado && (
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground">Último corte</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {ultimoCerrado.fecha_cierre ? fmtFecha(ultimoCerrado.fecha_cierre) : ''}
                </span>
                <Link
                  href={`/corte/${ultimoCerrado.id}/imprimir`}
                  className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t pt-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Esperado</p>
                  <p className="font-bold">{formatMXN(ultimoCerrado.monto_esperado ?? 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Contado</p>
                  <p className="font-bold">{formatMXN(ultimoCerrado.monto_contado ?? 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Diferencia</p>
                  <p
                    className={cn(
                      'font-bold',
                      (ultimoCerrado.diferencia ?? 0) >= 0
                        ? 'text-green-600'
                        : 'text-destructive',
                    )}
                  >
                    {(ultimoCerrado.diferencia ?? 0) >= 0 ? '+' : ''}
                    {formatMXN(ultimoCerrado.diferencia ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Formulario de apertura */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-base font-semibold">Abrir nueva caja</h2>
            </div>
            <FormAbrirCorte />
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCorte({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
