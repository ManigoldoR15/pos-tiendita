import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle, Clock, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { cn } from '@/lib/utils'
import FormAbrirCorte from './form-abrir'
import FormCerrarCorte from './form-cerrar'

import { fmtFechaHoraCorta } from '@/lib/fecha'
function fmtFecha(iso: string) { return fmtFechaHoraCorta(iso) }

export default async function CortePage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()

  // Corte abierto
  const { data: corteAbierto } = await supabase
    .from('cortes_caja')
    .select('id, monto_inicial, fecha_apertura, local_id, locales(nombre, color)')
    .eq('negocio_id', negocio.id)
    .eq('estado', 'abierto')
    .maybeSingle()

  // El embed locales(nombre, color) llega sin tipo generado
  const localCorte = (corteAbierto as { locales?: { nombre: string; color: string | null } | null } | null)
    ?.locales ?? null

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

  // (variable usada para calcular desglose más abajo, se agrupa en memoria)

  // Si hay corte abierto, cargar sus ventas
  let totalVentas = 0
  let numVentas = 0
  let ventasEfectivo = 0
  let montoEsperado = 0
  let desgloseMedios: { nombre: string; total: number; num: number }[] = []

  if (corteAbierto) {
    const { data: ventas } = await supabase
      .from('ventas')
      .select('total, metodo_pago_id, metodos_pago(nombre)')
      .eq('corte_id', corteAbierto.id)
      .eq('estado', 'completada')

    totalVentas = ventas?.reduce((s, v) => s + v.total, 0) ?? 0
    numVentas = ventas?.length ?? 0
    ventasEfectivo =
      ventas
        ?.filter((v) => v.metodo_pago_id === metodoPagoEfectivo?.id)
        .reduce((s, v) => s + v.total, 0) ?? 0
    montoEsperado = corteAbierto.monto_inicial + ventasEfectivo

    // Agrupar por método de pago
    const medioMap = new Map<string, { nombre: string; total: number; num: number }>()
    for (const v of ventas ?? []) {
      const nombre = (v.metodos_pago as unknown as { nombre: string } | null)?.nombre ?? 'Otro'
      const entry = medioMap.get(nombre) ?? { nombre, total: 0, num: 0 }
      entry.total += v.total
      entry.num += 1
      medioMap.set(nombre, entry)
    }
    desgloseMedios = [...medioMap.values()].sort((a, b) => b.total - a.total)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Corte de caja</h1>

      {corteAbierto ? (
        /* ── CAJA ABIERTA ── */
        <div className="space-y-4">
          {/* Estado */}
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800/40 dark:bg-green-950/20">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">Caja abierta</span>
            {localCorte?.nombre && (
              <span className="flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: localCorte.color ?? '#10b981' }} />
                {localCorte.nombre}
              </span>
            )}
            <span className="ml-auto text-xs text-green-600 dark:text-green-500">{fmtFecha(corteAbierto.fecha_apertura)}</span>
          </div>

          {/* Resumen del turno */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCorte label="Fondo inicial" value={formatMXN(corteAbierto.monto_inicial)} />
            <KpiCorte
              label="Ventas del turno"
              value={formatMXN(totalVentas)}
              sub={`${numVentas} ${numVentas === 1 ? 'venta' : 'ventas'}`}
            />
            <KpiCorte
              label="Efectivo en caja"
              value={formatMXN(montoEsperado)}
              sub="fondo + ventas efectivo"
            />
            <KpiCorte
              label="Otros medios"
              value={formatMXN(totalVentas - ventasEfectivo)}
              sub="tarjeta, SPEI…"
            />
          </div>

          {/* Desglose por método de pago */}
          {desgloseMedios.length > 0 && (
            <div className="card-soft overflow-hidden">
              <div className="border-b px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Desglose por método de pago
                </p>
              </div>
              <div className="divide-y">
                {desgloseMedios.map((m) => (
                  <div key={m.nombre} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{m.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.num} {m.num === 1 ? 'venta' : 'ventas'}
                      </p>
                    </div>
                    <p className="font-bold tabular-nums">{formatMXN(m.total)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulario de cierre */}
          <div className="card-soft p-5">
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
            <div className="card-soft p-5 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
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

              <div className="grid grid-cols-3 gap-3 border-t border-border/60 pt-3">
                <div className="text-center">
                  <p className="eyebrow text-[10px] mb-1">Esperado</p>
                  <p className="font-black tracking-tight">{formatMXN(ultimoCerrado.monto_esperado ?? 0)}</p>
                </div>
                <div className="text-center">
                  <p className="eyebrow text-[10px] mb-1">Contado</p>
                  <p className="font-black tracking-tight">{formatMXN(ultimoCerrado.monto_contado ?? 0)}</p>
                </div>
                <div className="text-center">
                  <p className="eyebrow text-[10px] mb-1">Diferencia</p>
                  <p className={cn(
                    'font-black tracking-tight',
                    (ultimoCerrado.diferencia ?? 0) >= 0 ? 'num-income' : 'num-expense',
                  )}>
                    {(ultimoCerrado.diferencia ?? 0) >= 0 ? '+' : ''}
                    {formatMXN(ultimoCerrado.diferencia ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Formulario de apertura */}
          <div className="card-soft p-5">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Abrir nueva caja</h2>
            </div>
            <FormAbrirCorte />
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCorte({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-soft p-3 sm:p-4">
      <p className="eyebrow text-[10px] mb-1">{label}</p>
      <p className="font-black tracking-tight num-neutral">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
