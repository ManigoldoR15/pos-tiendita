import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Scale, Download, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { formatMXN } from '@/lib/dinero'
import { mexicoDayRange } from '@/lib/fecha'
import { cn } from '@/lib/utils'
import { DonutEgresos, BarrasSeisM, type DonutSlice, type MesBar } from './finanzas-charts'
import PresupuestoForm from './presupuesto-form'

// ── helpers ────────────────────────────────────────────────────────────────────

function mesLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-MX', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  })
}

function prevMes(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function nextMes(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function mesRange(ym: string): { start: string; end: string; startDate: string; endDate: string } {
  const [y, m] = ym.split('-').map(Number)
  const firstDay = `${ym}-01`
  const lastDate = new Date(Date.UTC(y, m, 0))
  const lastDay = `${ym}-${String(lastDate.getUTCDate()).padStart(2, '0')}`
  const { start } = mexicoDayRange(firstDay)
  const { end } = mexicoDayRange(lastDay)
  return { start, end, startDate: firstDay, endDate: lastDay }
}

function hoyYM(): string {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
  return d.slice(0, 7)
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const rol = await getRolActual()
  if (rol !== 'dueno') redirect('/')

  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const { mes: mesParam } = await searchParams
  const mesActual = /^\d{4}-\d{2}$/.test(mesParam ?? '') ? mesParam! : hoyYM()
  const rango = mesRange(mesActual)
  const rangoPrev = mesRange(prevMes(mesActual))

  const supabase = await createClient()

  // ── Parallel queries ────────────────────────────────────────────────────────
  const [
    { data: ventasMes },
    { data: gastosMes },
    { data: gastosPrevMes },
    { data: categorias },
    { data: itemsMes },
  ] = await Promise.all([
    // Ventas del mes
    supabase
      .from('ventas')
      .select('total')
      .eq('negocio_id', negocio.id)
      .eq('estado', 'completada')
      .gte('created_at', rango.start)
      .lte('created_at', rango.end),

    // Gastos del mes
    supabase
      .from('gastos')
      .select('monto, es_personal, categoria_id, categorias_gasto(nombre)')
      .eq('negocio_id', negocio.id)
      .gte('fecha', rango.startDate)
      .lte('fecha', rango.endDate),

    // Gastos mes anterior (comparativa)
    supabase
      .from('gastos')
      .select('monto, es_personal')
      .eq('negocio_id', negocio.id)
      .gte('fecha', rangoPrev.startDate)
      .lte('fecha', rangoPrev.endDate),

    // Categorías con presupuesto
    supabase
      .from('categorias_gasto')
      .select('id, nombre, presupuesto')
      .eq('negocio_id', negocio.id)
      .order('nombre'),

    // Venta items del mes (para top productos por ganancia)
    supabase
      .from('venta_items')
      .select('cantidad, subtotal, producto_id, productos(nombre, precio_costo), ventas!inner(created_at, estado)')
      .eq('ventas.estado', 'completada')
      .gte('ventas.created_at', rango.start)
      .lte('ventas.created_at', rango.end),
  ])

  // ── 6-month bar chart ───────────────────────────────────────────────────────
  const seisM: MesBar[] = []
  for (let i = 5; i >= 0; i--) {
    const [y, m] = mesActual.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const r = mesRange(ym)
    const label = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 15))
      .toLocaleDateString('es-MX', { timeZone: 'UTC', month: 'short' })
    seisM.push({ mes: label, ingresos: 0, egresos: 0 })
    // We'll fill in inline — but to avoid 12 queries we use a simpler approach:
    // just mark placeholders; replace current month with real data
    if (i === 0) {
      seisM[seisM.length - 1].ingresos = (ventasMes ?? []).reduce((s, v) => s + v.total, 0)
      seisM[seisM.length - 1].egresos = (gastosMes ?? []).filter((g) => !g.es_personal).reduce((s, g) => s + g.monto, 0)
    }
  }

  // Fetch the other 5 months in one go via a broader range
  const [y0, m0] = mesActual.split('-').map(Number)
  const d5ago = new Date(Date.UTC(y0, m0 - 6, 1))
  const range5start = mexicoDayRange(`${d5ago.getUTCFullYear()}-${String(d5ago.getUTCMonth() + 1).padStart(2, '0')}-01`).start
  const range5end = mexicoDayRange(`${mesActual}-01`).start  // exclusive — up to start of current month

  const [{ data: ventasPast }, { data: gastosPast }] = await Promise.all([
    supabase
      .from('ventas')
      .select('total, created_at')
      .eq('negocio_id', negocio.id)
      .eq('estado', 'completada')
      .gte('created_at', range5start)
      .lt('created_at', range5end),
    supabase
      .from('gastos')
      .select('monto, es_personal, fecha')
      .eq('negocio_id', negocio.id)
      .gte('fecha', `${d5ago.getUTCFullYear()}-${String(d5ago.getUTCMonth() + 1).padStart(2, '0')}-01`)
      .lt('fecha', `${mesActual}-01`),
  ])

  // Bucket past data into the 5 earlier month slots
  for (let i = 0; i < 5; i++) {
    const [y, m] = mesActual.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 - (5 - i), 1))
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`

    seisM[i].ingresos = (ventasPast ?? [])
      .filter((v) => v.created_at.startsWith(ym.slice(0, 4)) && new Date(v.created_at).getUTCMonth() + 1 === parseInt(ym.slice(5, 7)))
      .reduce((s, v) => s + v.total, 0)

    seisM[i].egresos = (gastosPast ?? [])
      .filter((g) => !g.es_personal && (g.fecha as string).startsWith(ym))
      .reduce((s, g) => s + g.monto, 0)
  }

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const ingresosMes = (ventasMes ?? []).reduce((s, v) => s + v.total, 0)
  const egresosMes = (gastosMes ?? []).filter((g) => !g.es_personal).reduce((s, g) => s + g.monto, 0)
  const retirosMes = (gastosMes ?? []).filter((g) => g.es_personal).reduce((s, g) => s + g.monto, 0)
  const balanceMes = ingresosMes - egresosMes

  const ingresosPrev = 0  // Ventas del mes anterior no se consultó para simplificar; usamos egresos
  const egresosPrev = (gastosPrevMes ?? []).filter((g) => !g.es_personal).reduce((s, g) => s + g.monto, 0)

  // ── Egresos por categoría ───────────────────────────────────────────────────
  type CatEgreso = { id: string; nombre: string; presupuesto: number | null; real: number }
  const catMap = new Map<string, CatEgreso>()
  for (const cat of categorias ?? []) {
    catMap.set(cat.id, { id: cat.id, nombre: cat.nombre, presupuesto: cat.presupuesto ?? null, real: 0 })
  }
  for (const g of gastosMes ?? []) {
    if (g.es_personal) continue
    const entry = catMap.get(g.categoria_id)
    if (entry) entry.real += g.monto
  }
  const egresosXCat = [...catMap.values()].filter((c) => c.real > 0 || c.presupuesto)
    .sort((a, b) => b.real - a.real)

  // ── Donut slices ────────────────────────────────────────────────────────────
  const donutData: DonutSlice[] = egresosXCat
    .filter((c) => c.real > 0)
    .map((c) => ({ nombre: c.nombre, monto: c.real }))

  // ── Top 10 productos por ganancia ───────────────────────────────────────────
  type ProdGanancia = { nombre: string; unidades: number; ganancia: number }
  const prodMap = new Map<string, ProdGanancia>()
  for (const item of itemsMes ?? []) {
    const prod = item.productos as unknown as { nombre: string; precio_costo: number | null } | null
    const nombre = prod?.nombre ?? 'Producto eliminado'
    const pc = prod?.precio_costo ?? 0
    const pv = pc > 0 ? item.subtotal / item.cantidad : 0
    const margenUnit = pv - pc
    const entry = prodMap.get(item.producto_id) ?? { nombre, unidades: 0, ganancia: 0 }
    entry.unidades += item.cantidad
    entry.ganancia += margenUnit * item.cantidad
    prodMap.set(item.producto_id, entry)
  }
  const top10 = [...prodMap.values()]
    .filter((p) => p.ganancia > 0)
    .sort((a, b) => b.ganancia - a.ganancia)
    .slice(0, 10)

  // ── Comparativa vs mes anterior ─────────────────────────────────────────────
  const pctEgresos = egresosPrev > 0
    ? Math.round(((egresosMes - egresosPrev) / egresosPrev) * 100)
    : null

  const isCurrentMonth = mesActual === hoyYM()
  const nextYM = nextMes(mesActual)
  const canGoNext = !isCurrentMonth

  return (
    <div className="space-y-6">
      {/* Header + navegación mes */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Finanzas</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/finanzas?mes=${prevMes(mesActual)}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[140px] text-center text-sm font-semibold capitalize">
            {mesLabel(mesActual)}
          </span>
          <Link
            href={canGoNext ? `/finanzas?mes=${nextYM}` : '#'}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
              canGoNext ? 'hover:bg-accent' : 'opacity-30 pointer-events-none',
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          <a
            href={`/api/export/finanzas?mes=${mesActual}`}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Download className="h-4 w-4" />
            Excel
          </a>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ingresos</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatMXN(ingresosMes)}</p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Egresos</span>
            </div>
            {pctEgresos !== null && (
              <span className={cn(
                'text-xs font-semibold',
                pctEgresos > 0 ? 'text-red-500' : 'text-emerald-600',
              )}>
                {pctEgresos > 0 ? '↑' : '↓'} {Math.abs(pctEgresos)}% vs mes ant.
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">{formatMXN(egresosMes)}</p>
        </div>

        <div className={cn(
          'rounded-xl border p-5 shadow-sm',
          balanceMes >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-red-50 dark:bg-red-950/20',
        )}>
          <div className="mb-2 flex items-center gap-2">
            <Scale className={cn('h-5 w-5', balanceMes >= 0 ? 'text-emerald-500' : 'text-red-500')} />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Balance</span>
          </div>
          <p className={cn(
            'text-3xl font-bold',
            balanceMes >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
          )}>
            {formatMXN(balanceMes)}
          </p>
        </div>
      </div>

      {/* Retiros personales */}
      {retirosMes > 0 && (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-sm">
          <User className="h-5 w-5 shrink-0 text-orange-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Retiros personales del dueño</p>
            <p className="text-xs text-muted-foreground">No incluidos en egresos del negocio</p>
          </div>
          <p className="text-xl font-bold text-orange-500">{formatMXN(retirosMes)}</p>
        </div>
      )}

      {/* Grid: tabla egresos por categoría + donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Tabla egresos por categoría — 3/5 */}
        <div className="lg:col-span-3 rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h2 className="text-sm font-semibold">Egresos por categoría</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Haz clic en el presupuesto para editarlo</p>
          </div>
          {egresosXCat.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Sin egresos este mes</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-4 py-2 text-left">Categoría</th>
                  <th className="px-4 py-2 text-right">Presupuesto</th>
                  <th className="px-4 py-2 text-right">Real</th>
                  <th className="px-4 py-2 text-right w-20">%</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {egresosXCat.map((c) => {
                  const sobre = c.presupuesto && c.real > c.presupuesto
                  const pct = c.presupuesto ? Math.round((c.real / c.presupuesto) * 100) : null
                  return (
                    <tr key={c.id} className={cn(sobre && 'bg-red-50/60 dark:bg-red-950/20')}>
                      <td className="px-4 py-2.5 font-medium">{c.nombre}</td>
                      <td className="px-4 py-2.5 text-right">
                        <PresupuestoForm categoriaId={c.id} presupuestoActual={c.presupuesto} />
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', sobre ? 'text-destructive' : '')}>
                        {formatMXN(c.real)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {pct !== null ? (
                          <span className={cn('font-semibold', sobre ? 'text-destructive' : 'text-muted-foreground')}>
                            {pct}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Donut — 2/5 */}
        <div className="lg:col-span-2 rounded-xl border bg-card shadow-sm p-4">
          <h2 className="mb-2 text-sm font-semibold">Distribución de egresos</h2>
          <DonutEgresos data={donutData} />
          <div className="mt-2 space-y-1">
            {donutData.slice(0, 5).map((d, i) => (
              <div key={d.nombre} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)'][i] }}
                />
                <span className="flex-1 truncate text-muted-foreground">{d.nombre}</span>
                <span className="font-medium tabular-nums">{formatMXN(d.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Barras 6 meses */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Ingresos vs Egresos — últimos 6 meses</h2>
        <BarrasSeisM data={seisM} />
      </div>

      {/* Top 10 productos por ganancia */}
      {top10.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h2 className="text-sm font-semibold">Top productos por ganancia generada</h2>
            <p className="text-xs text-muted-foreground mt-0.5">unidades vendidas × (precio − costo)</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Producto</th>
                <th className="px-4 py-2 text-right">Unidades</th>
                <th className="px-4 py-2 text-right">Ganancia</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {top10.map((p, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium max-w-[220px] truncate">{p.nombre}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{p.unidades}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatMXN(p.ganancia)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
