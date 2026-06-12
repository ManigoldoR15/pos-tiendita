import Link from 'next/link'
import { ShoppingCart, Receipt, TrendingUp, TrendingDown, Package, AlertTriangle, Target } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { getRango, PERIODOS, type Periodo } from '@/lib/periodo'
import { STOCK_MINIMO } from '@/lib/constantes'
import { cn } from '@/lib/utils'
import { hoyMX, addDaysMX, mexicoDayRange } from '@/lib/fecha'
import { SalesChart, type DiaVenta } from '@/components/dashboard/sales-chart'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string }>
}) {
  const { p = 'hoy', desde, hasta } = await searchParams
  const periodo = p as Periodo

  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rango = getRango(periodo, desde, hasta)
  const supabase = await createClient()

  // 7-day chart range (fixed, not affected by period filter)
  const hoy = hoyMX()
  const hace7 = addDaysMX(hoy, -6)
  const chart7Start = mexicoDayRange(hace7).start
  const chart7End = mexicoDayRange(hoy).end

  // Current month range (for meta progress — always month view regardless of period filter)
  const mesInicio = hoy.substring(0, 8) + '01'
  const { start: mesStart } = mexicoDayRange(mesInicio)
  const { end: mesEnd } = mexicoDayRange(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })
      .format(new Date(Date.UTC(parseInt(hoy.slice(0, 4)), parseInt(hoy.slice(5, 7)), 0))),
  )

  const [
    { data: ventas },
    { data: gastos },
    { data: items },
    { count: numStockBajo },
    { data: ventasSemana },
    { data: metaMes },
    { data: ventasMes },
  ] = await Promise.all([
    supabase
      .from('ventas')
      .select('total')
      .eq('negocio_id', negocio.id)
      .eq('estado', 'completada')
      .gte('created_at', rango.start)
      .lte('created_at', rango.end),

    supabase
      .from('gastos')
      .select('monto, es_personal')
      .eq('negocio_id', negocio.id)
      .gte('fecha', rango.startDate)
      .lte('fecha', rango.endDate),

    supabase
      .from('venta_items')
      .select(
        'cantidad, subtotal, producto_id, productos(nombre, precio_costo), ventas!inner(created_at, estado)',
      )
      .eq('ventas.estado', 'completada')
      .gte('ventas.created_at', rango.start)
      .lte('ventas.created_at', rango.end),

    supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .lte('existencias', STOCK_MINIMO)
      .gt('existencias', 0),

    supabase
      .from('ventas')
      .select('total, created_at')
      .eq('negocio_id', negocio.id)
      .eq('estado', 'completada')
      .gte('created_at', chart7Start)
      .lte('created_at', chart7End),

    supabase
      .from('metas')
      .select('meta_ventas')
      .eq('negocio_id', negocio.id)
      .eq('mes', mesInicio)
      .single(),

    supabase
      .from('ventas')
      .select('total')
      .eq('negocio_id', negocio.id)
      .eq('estado', 'completada')
      .gte('created_at', mesStart)
      .lte('created_at', mesEnd),
  ])

  // 7-day chart data (Mexico calendar days)
  const diasChart: DiaVenta[] = Array.from({ length: 7 }, (_, i) => {
    const fecha = addDaysMX(hoy, -(6 - i))
    const { start, end } = mexicoDayRange(fecha)
    const totalDia = (ventasSemana ?? [])
      .filter((v) => v.created_at >= start && v.created_at <= end)
      .reduce((s, v) => s + v.total, 0)
    return { fecha, total: totalDia }
  })

  // KPIs
  const totalVentas = ventas?.reduce((s, v) => s + v.total, 0) ?? 0
  const numVentas = ventas?.length ?? 0
  const totalGastos =
    gastos?.filter((g) => !g.es_personal).reduce((s, g) => s + g.monto, 0) ?? 0
  const utilidad = totalVentas - totalGastos

  // Ganancia bruta = ingresos - costo de mercancía vendida
  const costoVentas = (items ?? []).reduce((s, item) => {
    const pc = (item.productos as unknown as { nombre: string; precio_costo: number | null } | null)?.precio_costo ?? 0
    return s + item.cantidad * pc
  }, 0)
  const gananciaBruta = totalVentas - costoVentas

  // Meta del mes
  const metaValor = metaMes?.meta_ventas ?? null
  const ventasMesTotal = (ventasMes ?? []).reduce((s, v) => s + v.total, 0)
  const metaPct = metaValor ? Math.min(100, Math.round((ventasMesTotal / metaValor) * 100)) : null

  // Proyección: días transcurridos / días del mes × ventas actuales del mes
  const diaActual = parseInt(hoy.slice(8, 10))
  const diasDelMes = new Date(parseInt(hoy.slice(0, 4)), parseInt(hoy.slice(5, 7)), 0).getDate()
  const proyeccion = diaActual > 0 ? Math.round((ventasMesTotal / diaActual) * diasDelMes) : null

  // Top productos
  type ProdEntry = { nombre: string; unidades: number; monto: number }
  const prodMap = new Map<string, ProdEntry>()
  for (const item of items ?? []) {
    const nombre =
      (item.productos as unknown as { nombre: string } | null)?.nombre ?? 'Producto eliminado'
    const entry = prodMap.get(item.producto_id) ?? { nombre, unidades: 0, monto: 0 }
    entry.unidades += item.cantidad
    entry.monto += item.subtotal
    prodMap.set(item.producto_id, entry)
  }
  const topUnidades = [...prodMap.values()].sort((a, b) => b.unidades - a.unidades).slice(0, 5)
  const topMonto = [...prodMap.values()].sort((a, b) => b.monto - a.monto).slice(0, 5)
  const maxUnidades = topUnidades[0]?.unidades ?? 1
  const maxMonto = topMonto[0]?.monto ?? 1


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{negocio.nombre}</h1>
        <div className="flex items-center gap-2">
          {/* Links de acceso rápido */}
          <Link
            href="/pos"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <ShoppingCart className="h-4 w-4" />
            POS
          </Link>
          <Link
            href="/gastos/nuevo"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <Receipt className="h-4 w-4" />
            Gasto
          </Link>
        </div>
      </div>

      {/* Filtro de periodo */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map(({ label, value }) => (
          <Link
            key={value}
            href={`/?p=${value}`}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              periodo === value
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent',
            )}
          >
            {label}
          </Link>
        ))}

        {/* Rango custom */}
        {periodo === 'rango' && (
          <form method="GET" action="/" className="flex items-center gap-2 flex-wrap">
            <input type="hidden" name="p" value="rango" />
            <input
              name="desde"
              type="date"
              defaultValue={desde ?? rango.startDate}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">—</span>
            <input
              name="hasta"
              type="date"
              defaultValue={hasta ?? rango.endDate}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Aplicar
            </button>
          </form>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Ventas"
          value={formatMXN(totalVentas)}
          sub={`${numVentas} ${numVentas === 1 ? 'venta' : 'ventas'}`}
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          accent="emerald"
        />
        <KpiCard
          label="Ganancia bruta"
          value={formatMXN(gananciaBruta)}
          sub="ingresos − costo"
          icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
          accent={gananciaBruta >= 0 ? 'blue' : 'red'}
        />
        <KpiCard
          label="Gastos negocio"
          value={formatMXN(totalGastos)}
          sub="sin personales"
          icon={<TrendingDown className="h-5 w-5 text-red-500" />}
          accent="red"
        />
        <KpiCard
          label="Utilidad neta"
          value={formatMXN(utilidad)}
          sub="ventas − gastos"
          icon={<Package className="h-5 w-5 text-primary" />}
          accent={utilidad >= 0 ? 'emerald' : 'red'}
        />
      </div>

      {/* Meta del mes */}
      {metaValor && metaPct !== null && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold">Meta del mes</span>
            </div>
            <span className={cn(
              'text-sm font-bold',
              metaPct >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
              metaPct >= 70 ? 'text-primary' : 'text-muted-foreground',
            )}>
              {metaPct}%
            </span>
          </div>
          <div className="mb-2 h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                metaPct >= 100 ? 'bg-emerald-500' :
                metaPct >= 70 ? 'bg-primary' : 'bg-primary/60',
              )}
              style={{ width: `${metaPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatMXN(ventasMesTotal)} de {formatMXN(metaValor)}
            </span>
            {proyeccion !== null && proyeccion > 0 && (
              <span>
                Proyección: <strong>{formatMXN(proyeccion)}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {!metaValor && (
        <Link
          href="/configuracion"
          className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <Target className="h-4 w-4 shrink-0" />
          <span>Establece una meta de ventas mensual en Configuración</span>
          <span className="ml-auto">→</span>
        </Link>
      )}

      {/* Alerta stock bajo */}
      {(numStockBajo ?? 0) > 0 && (
        <Link
          href="/productos?alerta=bajo"
          className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800/40 px-4 py-3 text-sm font-medium text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/30 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" />
          <span>
            <strong>{numStockBajo}</strong>{' '}
            {numStockBajo === 1 ? 'producto tiene' : 'productos tienen'} stock bajo (≤ {STOCK_MINIMO} unidades)
          </span>
          <span className="ml-auto text-orange-500">Ver →</span>
        </Link>
      )}

      {/* Gráfica ventas últimos 7 días */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Ventas — últimos 7 días
        </h3>
        <SalesChart data={diasChart} />
      </div>

      {/* Top productos */}
      {topUnidades.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TopProductos
            titulo="Top por unidades"
            productos={topUnidades}
            formatVal={(p) => `${p.unidades} uds`}
            maxVal={maxUnidades}
            valNum={(p) => p.unidades}
          />
          <TopProductos
            titulo="Top por monto"
            productos={topMonto}
            formatVal={(p) => formatMXN(p.monto)}
            maxVal={maxMonto}
            valNum={(p) => p.monto}
          />
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-8 text-center">
          <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">Sin ventas en este periodo.</p>
          <Link href="/pos" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
            Ir al POS →
          </Link>
        </div>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  accent: 'emerald' | 'blue' | 'red' | 'default'
}) {
  const valueColor = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
    red: 'text-red-600 dark:text-red-400',
    default: 'text-foreground',
  }[accent]

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <p className={cn('text-xl font-bold leading-tight', valueColor)}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

type ProdEntry = { nombre: string; unidades: number; monto: number }

function TopProductos({
  titulo,
  productos,
  formatVal,
  maxVal,
  valNum,
}: {
  titulo: string
  productos: ProdEntry[]
  formatVal: (p: ProdEntry) => string
  maxVal: number
  valNum: (p: ProdEntry) => number
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {titulo}
      </h3>
      <div className="space-y-3">
        {productos.map((p, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium truncate flex-1 mr-2">{p.nombre}</span>
              <span className="text-sm font-bold shrink-0 text-primary">{formatVal(p)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.round((valNum(p) / maxVal) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
