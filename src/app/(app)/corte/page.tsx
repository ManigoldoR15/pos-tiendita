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
  let ventasOtrosMedios = 0
  let totalFiado = 0
  let abonosFiadoEfectivo = 0
  let gastosEfectivo = 0
  let comprasEfectivo = 0
  let montoEsperado = 0
  let desgloseMedios: { nombre: string; total: number; num: number }[] = []

  if (corteAbierto) {
    const { data: ventas } = await supabase
      .from('ventas')
      .select('total, metodo_pago_id, metodos_pago(nombre), venta_items(subtotal, es_fiado)')
      .eq('corte_id', corteAbierto.id)
      .eq('estado', 'completada')

    // Lo fiado no entra al cajón: al cobrar solo se pide (total - fiado), así que
    // sumar el total completo marcaría un faltante del tamaño de lo que se fió.
    // Misma fórmula que cerrar_corte() en la BD; si divergieran, la pantalla
    // prometería un esperado distinto al del cierre.
    const contadoDe = (v: { total: number; venta_items?: { subtotal: number; es_fiado: boolean }[] | null }) => {
      const fiado = (v.venta_items ?? []).reduce((s, i) => (i.es_fiado ? s + i.subtotal : s), 0)
      return Math.max(0, v.total - fiado)
    }

    totalVentas = ventas?.reduce((s, v) => s + v.total, 0) ?? 0
    numVentas = ventas?.length ?? 0
    ventasEfectivo =
      ventas
        ?.filter((v) => v.metodo_pago_id === metodoPagoEfectivo?.id)
        .reduce((s, v) => s + contadoDe(v), 0) ?? 0
    ventasOtrosMedios =
      ventas
        ?.filter((v) => v.metodo_pago_id !== metodoPagoEfectivo?.id)
        .reduce((s, v) => s + contadoDe(v), 0) ?? 0
    totalFiado = ventas?.reduce((s, v) => s + (v.total - contadoDe(v)), 0) ?? 0

    // Todo lo demás que mueve el cajón. La pantalla tiene que dar el mismo
    // número que cerrar_corte(), o promete un esperado y al cerrar aplica otro.
    let abonosApartadoEfectivo = 0
    if (metodoPagoEfectivo?.id) {
      const [{ data: abApartado }, { data: abFiado }, { data: gastosCaja }, { data: comprasCaja }] = await Promise.all([
        supabase
          .from('apartado_abonos')
          .select('monto')
          .eq('corte_id', corteAbierto.id)
          .eq('metodo_pago_id', metodoPagoEfectivo.id),
        // Clientes que vinieron a pagar su fiado: ese billete entró al cajón
        supabase
          .from('abonos')
          .select('monto')
          .eq('corte_id', corteAbierto.id)
          .eq('metodo_pago_id', metodoPagoEfectivo.id),
        // Gastos pagados del cajón: ese billete salió
        supabase
          .from('gastos')
          .select('monto')
          .eq('corte_id', corteAbierto.id)
          .eq('metodo_pago_id', metodoPagoEfectivo.id),
        // Mercancía pagada del cajón: ese billete también salió
        supabase
          .from('compras')
          .select('total')
          .eq('corte_id', corteAbierto.id)
          .eq('metodo_pago_id', metodoPagoEfectivo.id),
      ])
      abonosApartadoEfectivo = (abApartado ?? []).reduce((s, a) => s + a.monto, 0)
      abonosFiadoEfectivo = (abFiado ?? []).reduce((s, a) => s + a.monto, 0)
      gastosEfectivo = (gastosCaja ?? []).reduce((s, g) => s + g.monto, 0)
      comprasEfectivo = (comprasCaja ?? []).reduce((s, c) => s + c.total, 0)
    }

    montoEsperado =
      corteAbierto.monto_inicial + ventasEfectivo + abonosApartadoEfectivo
      + abonosFiadoEfectivo - gastosEfectivo - comprasEfectivo

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
              sub="fondo + cobrado en efectivo"
            />
            <KpiCorte
              label="Otros medios"
              value={formatMXN(ventasOtrosMedios)}
              sub="tarjeta, SPEI…"
            />
          </div>

          {/* De dónde sale el efectivo esperado. Sin este desglose el tendero ve
              un número que no cuadra con sus ventas y no tiene cómo revisarlo. */}
          {(abonosFiadoEfectivo > 0 || gastosEfectivo > 0 || comprasEfectivo > 0) && (
            <div className="card-soft divide-y">
              <div className="px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  De dónde sale el efectivo esperado
                </p>
              </div>
              <Renglon label="Fondo inicial" valor={formatMXN(corteAbierto.monto_inicial)} />
              <Renglon label="Cobrado en efectivo" valor={`+ ${formatMXN(ventasEfectivo)}`} />
              {abonosFiadoEfectivo > 0 && (
                <Renglon label="Fiados que te pagaron" valor={`+ ${formatMXN(abonosFiadoEfectivo)}`} />
              )}
              {gastosEfectivo > 0 && (
                <Renglon label="Gastos pagados del cajón" valor={`− ${formatMXN(gastosEfectivo)}`} rojo />
              )}
              {comprasEfectivo > 0 && (
                <Renglon label="Mercancía pagada del cajón" valor={`− ${formatMXN(comprasEfectivo)}`} rojo />
              )}
              <div className="flex items-center justify-between px-4 py-2.5">
                <p className="text-sm font-bold">Debe haber en caja</p>
                <p className="font-black tabular-nums">{formatMXN(montoEsperado)}</p>
              </div>
            </div>
          )}

          {/* Lo fiado se vendió pero no entró al cajón: sin esta línea el corte
              parece faltante y el tendero cree que le robaron. */}
          {totalFiado > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/20">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                Se fió {formatMXN(totalFiado)} en este turno
              </p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-500">
                Ese dinero no está en la caja todavía, por eso no se cuenta en el efectivo esperado.
              </p>
            </div>
          )}

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

function Renglon({ label, valor, rojo = false }: { label: string; valor: string; rojo?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('text-sm font-semibold tabular-nums', rojo && 'num-expense')}>{valor}</p>
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
