import Link from 'next/link'
import {
  ShoppingCart, Receipt, AlertTriangle, Target, CalendarX,
  HandCoins, Users, Clock, BarChart2, FileText, Wallet,
  Package, ChevronRight,
} from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { getRango, PERIODOS, type Periodo } from '@/lib/periodo'
import { STOCK_MINIMO } from '@/lib/constantes'
import { cn } from '@/lib/utils'
import { hoyMX, addDaysMX, mexicoDayRange, TZ } from '@/lib/fecha'
import { SalesChart, type DiaVenta } from '@/components/dashboard/sales-chart'
import { getRolActual } from '@/lib/rol'
import AvisarJefeForm from './avisar-jefe-form'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string }>
}) {
  const { p = 'hoy', desde, hasta } = await searchParams
  const periodo = p as Periodo

  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const rol = await getRolActual()
  const isDuenoOrAdmin = !rol || rol === 'dueno' || rol === 'administrador'

  const hoy = hoyMX()
  const en3dias = addDaysMX(hoy, 3)

  // Fecha y hora en México para el header contextual
  const now = new Date()
  const horaActual = new Intl.DateTimeFormat('es-MX', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit',
  }).format(now)
  const fechaLabel = new Intl.DateTimeFormat('es-MX', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long',
  }).format(now)

  // ── Alertas compartidas (ambos roles las ven, son datos operacionales) ────
  const [
    { count: numStockBajo },
    { count: numLotesAlerta },
    { data: productosAlertaLista },
    { data: lotesAlertaLista },
  ] = await Promise.all([
    supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .lte('existencias', STOCK_MINIMO)
      .gt('existencias', 0),
    supabase
      .from('lotes_producto')
      .select('*', { count: 'exact', head: true })
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .or(`fecha_caducidad.lte.${en3dias},estado_manual.eq.negro`),
    supabase
      .from('productos')
      .select('nombre, existencias')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .lte('existencias', STOCK_MINIMO)
      .gt('existencias', 0)
      .order('existencias', { ascending: true })
      .limit(4),
    supabase
      .from('lotes_producto')
      .select('cantidad, fecha_caducidad, estado_manual, productos(nombre)')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .or(`fecha_caducidad.lte.${en3dias},estado_manual.eq.negro`)
      .order('fecha_caducidad', { ascending: true })
      .limit(4),
  ])

  // ── Nombre personal para saludo ──────────────────────────────────────────
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const emailRaw = currentUser?.email?.split('@')[0] ?? ''
  const nombreDisplay = emailRaw
    ? emailRaw.split(/[._-]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : negocio.nombre
  const horaNum = parseInt(horaActual.split(':')[0])
  const saludoTexto = horaNum < 12 ? 'Buenos días' : horaNum < 19 ? 'Buenas tardes' : 'Buenas noches'

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA EMPLEADO — sin datos financieros del negocio
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isDuenoOrAdmin) {
    const user = currentUser

    // Turno activo del empleado
    const { data: corteActual } = user
      ? await supabase
          .from('cortes_caja')
          .select('id, fecha_apertura, local_id')
          .eq('negocio_id', negocio.id)
          .eq('abierto_por', user.id)
          .eq('estado', 'abierto')
          .maybeSingle()
      : { data: null }

    // Ventas del turno (datos propios del cajero, no finanzas del negocio)
    let ventasTurno = 0
    let numVentasTurno = 0
    if (corteActual?.fecha_apertura) {
      const { data: vt } = await supabase
        .from('ventas')
        .select('total')
        .eq('negocio_id', negocio.id)
        .eq('estado', 'completada')
        .gte('created_at', corteActual.fecha_apertura)
      ventasTurno = (vt ?? []).reduce((s, v) => s + v.total, 0)
      numVentasTurno = (vt ?? []).length
    }

    const horaApertura = corteActual?.fecha_apertura
      ? new Date(corteActual.fecha_apertura).toLocaleTimeString('es-MX', {
          timeZone: TZ, hour: '2-digit', minute: '2-digit',
        })
      : null

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="rounded-2xl bg-primary/[0.06] px-6 py-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-primary/70">
            {fechaLabel} · {horaActual}
          </p>
          <h1 className="text-2xl font-black tracking-tight">Hola, {nombreDisplay}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {corteActual
              ? `Caja abierta desde las ${horaApertura} · ${negocio.nombre}`
              : `Sin turno abierto — ${negocio.nombre}`}
          </p>
        </div>

        {/* CTA principal */}
        <Link
          href="/pos"
          className="flex items-center justify-between gap-4 rounded-2xl bg-primary px-6 py-5 text-primary-foreground shadow-md hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-xl font-black tracking-tight">Cobrar venta</p>
              <p className="text-sm opacity-80">Abrir el punto de venta</p>
            </div>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 opacity-70" />
        </Link>

        {/* Mi turno */}
        {corteActual ? (
          <div className="card-soft p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold">Mi turno</span>
              </div>
              <Link href="/corte" className="text-xs font-medium text-primary hover:underline">
                Ver caja →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-xl bg-muted/50 px-4 py-3">
                <p className="mb-1 text-xs text-muted-foreground">Ventas del turno</p>
                <p className="text-2xl font-black tracking-tight num-neutral">{numVentasTurno}</p>
              </div>
              <div className="rounded-xl bg-muted/50 px-4 py-3">
                <p className="mb-1 text-xs text-muted-foreground">Total del turno</p>
                <p className="text-2xl font-black tracking-tight num-neutral">{formatMXN(ventasTurno)}</p>
              </div>
            </div>
            <Link
              href="/corte"
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              <Wallet className="h-4 w-4" />
              Cerrar caja / hacer corte
            </Link>
          </div>
        ) : (
          <Link
            href="/corte"
            className="flex items-center gap-3 rounded-2xl border border-dashed px-5 py-4 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            <Wallet className="h-4 w-4 shrink-0" />
            <span>Abre tu caja para comenzar el turno</span>
            <span className="ml-auto">→</span>
          </Link>
        )}

        {/* Accesos rápidos */}
        <div className="grid grid-cols-3 gap-3">
          <AccesoRapido href="/corte" Icon={Wallet} label="Mi caja" sub="Corte y apertura" />
          <AccesoRapido href="/productos" Icon={Package} label="Inventario" sub="Existencias" />
          <AccesoRapido href="/compras" Icon={Receipt} label="Entrada" sub="Recibir mercancía" />
        </div>

        {/* Avisar al jefe */}
        <AvisarJefeForm />

        {/* Para reabastecer hoy */}
        {((numStockBajo ?? 0) > 0 || (numLotesAlerta ?? 0) > 0) && (
          <div className="card-soft overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="eyebrow">Para reabastecer hoy</h3>
            </div>
            <div className="divide-y">
              {(productosAlertaLista ?? []).map((prod, i) => (
                <div
                  key={`s${i}`}
                  className="flex items-center gap-3 bg-orange-50 dark:bg-orange-950/20 px-5 py-3"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500" />
                  <span className="flex-1 min-w-0 text-sm font-medium truncate">{prod.nombre}</span>
                  <span className="shrink-0 text-xs font-semibold text-orange-600 dark:text-orange-400">
                    Quedan {prod.existencias}
                  </span>
                </div>
              ))}
              {(lotesAlertaLista ?? []).map((lote, i) => {
                const nombre = (lote.productos as unknown as { nombre: string } | null)?.nombre ?? 'Producto'
                const etiqueta =
                  lote.estado_manual === 'negro'
                    ? 'Vencido'
                    : lote.fecha_caducidad
                    ? `Vence ${new Date(lote.fecha_caducidad + 'T12:00:00Z').toLocaleDateString('es-MX', { timeZone: TZ, day: 'numeric', month: 'short' })}`
                    : 'Por caducar'
                return (
                  <div
                    key={`c${i}`}
                    className="flex items-center gap-3 bg-red-50 dark:bg-red-950/20 px-5 py-3"
                  >
                    <CalendarX className="h-4 w-4 shrink-0 text-red-500" />
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{nombre}</span>
                    <span className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400">
                      {etiqueta}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA DUEÑO / ADMIN — datos financieros completos
  // ═══════════════════════════════════════════════════════════════════════════

  const rango = getRango(periodo, desde, hasta)

  // 7-day chart range (fijo, no varía con el filtro de periodo)
  const hace7 = addDaysMX(hoy, -6)
  const chart7Start = mexicoDayRange(hace7).start
  const chart7End = mexicoDayRange(hoy).end

  // Rango del mes en curso (para la meta)
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
    { data: ventasSemana },
    { data: metaMes },
    { data: ventasMes },
    { data: fiadosPorCliente },
    { data: cajas },
    { data: miembros },
    { data: localesList },
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

    supabase
      .from('fiados_por_cliente')
      .select('cliente_id, deuda_total')
      .eq('negocio_id', negocio.id),

    supabase
      .from('cortes_caja')
      .select('id, abierto_por, fecha_apertura, local_id')
      .eq('negocio_id', negocio.id)
      .eq('estado', 'abierto')
      .order('fecha_apertura', { ascending: true }),

    supabase.rpc('get_miembros_negocio', { p_negocio_id: negocio.id }),

    supabase.from('locales').select('id, nombre').eq('negocio_id', negocio.id),
  ])

  // ── Cálculos KPI ─────────────────────────────────────────────────────────
  const totalVentas = ventas?.reduce((s, v) => s + v.total, 0) ?? 0
  const numVentas = ventas?.length ?? 0
  const ticketPromedio = numVentas > 0 ? Math.round(totalVentas / numVentas) : 0
  const totalGastos =
    gastos?.filter((g) => !g.es_personal).reduce((s, g) => s + g.monto, 0) ?? 0
  const utilidad = totalVentas - totalGastos

  const costoVentas = (items ?? []).reduce((s, item) => {
    const pc = (item.productos as unknown as { nombre: string; precio_costo: number | null } | null)
      ?.precio_costo ?? 0
    return s + item.cantidad * pc
  }, 0)
  const gananciaBruta = totalVentas - costoVentas
  const margenPct = totalVentas > 0 ? Math.round((gananciaBruta / totalVentas) * 100) : null

  // ── Meta del mes ─────────────────────────────────────────────────────────
  const metaValor = metaMes?.meta_ventas ?? null
  const ventasMesTotal = (ventasMes ?? []).reduce((s, v) => s + v.total, 0)
  const metaPct = metaValor ? Math.min(100, Math.round((ventasMesTotal / metaValor) * 100)) : null
  const diaActual = parseInt(hoy.slice(8, 10))
  const diasDelMes = new Date(parseInt(hoy.slice(0, 4)), parseInt(hoy.slice(5, 7)), 0).getDate()
  const proyeccion = diaActual > 0 ? Math.round((ventasMesTotal / diaActual) * diasDelMes) : null

  // ── Fiados ───────────────────────────────────────────────────────────────
  const totalFiados = (fiadosPorCliente ?? []).reduce((s, f) => s + f.deuda_total, 0)
  const numClientesFiados = (fiadosPorCliente ?? []).length

  // ── Quién trabaja ────────────────────────────────────────────────────────
  type CajaAbierta = { id: string; abierto_por: string; fecha_apertura: string; local_id: string | null }
  type MiembroInfo = { user_id: string; email: string; rol: string }
  const cajasAbiertas = (cajas ?? []) as CajaAbierta[]
  const miembrosMap = new Map((miembros as MiembroInfo[] ?? []).map((m) => [m.user_id, m.email]))
  const localesMap = new Map(
    (localesList ?? []).map((l: { id: string; nombre: string }) => [l.id, l.nombre]),
  )

  // ── Gráfica 7 días ───────────────────────────────────────────────────────
  const diasChart: DiaVenta[] = Array.from({ length: 7 }, (_, i) => {
    const fecha = addDaysMX(hoy, -(6 - i))
    const { start, end } = mexicoDayRange(fecha)
    const totalDia = (ventasSemana ?? [])
      .filter((v) => v.created_at >= start && v.created_at <= end)
      .reduce((s, v) => s + v.total, 0)
    return { fecha, total: totalDia }
  })

  // ── Top productos ─────────────────────────────────────────────────────────
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

  const periodoLabel = PERIODOS.find((x) => x.value === periodo)?.label ?? 'Hoy'

  return (
    <div className="space-y-7">
      {/* Header contextual */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {fechaLabel} · {horaActual}
          </p>
          <h1 className="text-2xl font-black tracking-tight">{saludoTexto}, {nombreDisplay}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Resumen de {negocio.nombre}</p>
        </div>
        <div className="flex items-center gap-2 self-start pt-1">
          <Link
            href="/pos"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <ShoppingCart className="h-4 w-4" />
            POS
          </Link>
          <Link
            href="/gastos/nuevo"
            className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium hover:bg-accent transition-colors"
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

      {/* Hero ventas */}
      <div className={cn('card-soft p-6 sm:p-7', numVentas > 0 && 'bg-primary/[0.04] dark:bg-primary/[0.08]')}>
        <p className="eyebrow mb-3">{`Ventas — ${periodoLabel.toLowerCase()}`}</p>
        <p className={cn(
          'text-5xl font-black tracking-tight leading-none tabular-nums sm:text-6xl',
          numVentas === 0 ? 'opacity-25' : 'text-primary',
        )}>
          {formatMXN(totalVentas)}
        </p>
        <p className="mt-2.5 text-sm text-muted-foreground">
          {numVentas > 0
            ? `${numVentas} ${numVentas === 1 ? 'venta' : 'ventas'} · ticket promedio ${formatMXN(ticketPromedio)}`
            : 'Sin ventas en este periodo'}
        </p>
      </div>

      {/* 3 KPIs secundarios */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Ganancia bruta"
          value={formatMXN(gananciaBruta)}
          sub={margenPct !== null ? `Margen ${margenPct}% sobre ventas` : 'ingresos − costo mercancía'}
          accent={gananciaBruta >= 0 ? 'default' : 'red'}
        />
        <KpiCard
          label="Gastos del negocio"
          value={formatMXN(totalGastos)}
          sub="sin gastos personales"
          accent="default"
        />
        <KpiCard
          label="Utilidad neta"
          value={formatMXN(utilidad)}
          sub="ventas − gastos"
          accent={utilidad >= 0 ? 'emerald' : 'red'}
        />
      </div>

      {/* Quién trabaja (solo si hay cajas abiertas) */}
      {cajasAbiertas.length > 0 && (
        <div className="card-soft p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold">En turno ahora</span>
            </div>
            <Link href="/turnos" className="text-xs font-medium text-primary hover:underline">
              Turnos →
            </Link>
          </div>
          <div className="space-y-2">
            {cajasAbiertas.map((caja) => {
              const email = miembrosMap.get(caja.abierto_por) ?? caja.abierto_por.slice(0, 8) + '…'
              const initials = email.substring(0, 2).toUpperCase()
              const local = caja.local_id
                ? (localesMap.get(caja.local_id) ?? negocio.nombre)
                : negocio.nombre
              const apertura = new Date(caja.fecha_apertura).toLocaleTimeString('es-MX', {
                timeZone: TZ, hour: '2-digit', minute: '2-digit',
              })
              return (
                <div key={caja.id} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{email}</p>
                    <p className="text-xs text-muted-foreground">{local}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>desde {apertura}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Meta del mes */}
      {metaValor && metaPct !== null && (
        <div className="card-soft p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold">Meta del mes</span>
            </div>
            <span
              className={cn(
                'text-sm font-bold',
                metaPct >= 100
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : metaPct >= 70
                  ? 'text-primary'
                  : 'text-muted-foreground',
              )}
            >
              {metaPct}%
            </span>
          </div>
          <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                metaPct >= 100
                  ? 'bg-emerald-500'
                  : metaPct >= 70
                  ? 'bg-primary'
                  : 'bg-primary/60',
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
                Proyección:{' '}
                <strong className="text-foreground">{formatMXN(proyeccion)}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {!metaValor && (
        <Link
          href="/configuracion"
          className="flex items-center gap-3 rounded-2xl border border-dashed px-5 py-4 text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <Target className="h-4 w-4 shrink-0" />
          <span>Establece una meta de ventas mensual en Configuración</span>
          <span className="ml-auto">→</span>
        </Link>
      )}

      {/* Alerta stock bajo — con mini-lista */}
      {(numStockBajo ?? 0) > 0 && (
        <div className="overflow-hidden rounded-2xl border border-orange-200 bg-orange-50 dark:border-orange-800/40 dark:bg-orange-950/20">
          <Link
            href="/productos?alerta=bajo"
            className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100/70 dark:text-orange-400 dark:hover:bg-orange-950/30"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" />
            <span>
              <strong>{numStockBajo}</strong>{' '}
              {numStockBajo === 1 ? 'producto tiene' : 'productos tienen'} stock bajo (≤{' '}
              {STOCK_MINIMO} unidades)
            </span>
            <span className="ml-auto shrink-0 text-orange-500">Ver →</span>
          </Link>
          {(productosAlertaLista ?? []).length > 0 && (
            <div className="divide-y divide-orange-200/50 border-t border-orange-200/60 dark:divide-orange-800/20 dark:border-orange-800/30">
              {(productosAlertaLista ?? []).slice(0, 3).map((prod, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-5 py-2 text-xs text-orange-700/80 dark:text-orange-400/80"
                >
                  <span className="truncate">{prod.nombre}</span>
                  <span className="ml-3 shrink-0 font-semibold">Quedan {prod.existencias}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerta caducidad — con mini-lista */}
      {(numLotesAlerta ?? 0) > 0 && (
        <div className="overflow-hidden rounded-2xl border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/20">
          <Link
            href="/caducidad?estado=negro"
            className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100/70 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <CalendarX className="h-5 w-5 shrink-0 text-red-500" />
            <span>
              <strong>{numLotesAlerta}</strong>{' '}
              {numLotesAlerta === 1 ? 'lote caduca' : 'lotes caducan'} en 3 días o ya está vencido
            </span>
            <span className="ml-auto shrink-0 text-red-500">Ver →</span>
          </Link>
          {(lotesAlertaLista ?? []).length > 0 && (
            <div className="divide-y divide-red-200/50 border-t border-red-200/60 dark:divide-red-800/20 dark:border-red-800/30">
              {(lotesAlertaLista ?? []).slice(0, 3).map((lote, i) => {
                const nombre =
                  (lote.productos as unknown as { nombre: string } | null)?.nombre ?? 'Producto'
                const etiqueta =
                  lote.estado_manual === 'negro'
                    ? 'Vencido'
                    : lote.fecha_caducidad
                    ? `vence ${new Date(lote.fecha_caducidad + 'T12:00:00Z').toLocaleDateString('es-MX', { timeZone: TZ, day: 'numeric', month: 'short' })}`
                    : 'por caducar'
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between px-5 py-2 text-xs text-red-700/80 dark:text-red-400/80"
                  >
                    <span className="truncate">{nombre}</span>
                    <span className="ml-3 shrink-0 font-semibold capitalize">{etiqueta}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Alerta fiados */}
      {numClientesFiados > 0 && (
        <Link
          href="/fiados"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-950/30"
        >
          <HandCoins className="h-5 w-5 shrink-0 text-amber-500" />
          <span>
            Por cobrar:{' '}
            <strong>{formatMXN(totalFiados)}</strong> de {numClientesFiados}{' '}
            {numClientesFiados === 1 ? 'cliente' : 'clientes'}
          </span>
          <span className="ml-auto text-amber-500">Ver →</span>
        </Link>
      )}

      {/* Gráfica 7 días */}
      <div className="card-soft p-6 sm:p-7">
        <h3 className="eyebrow mb-5">Ventas — últimos 7 días</h3>
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
        <div className="card-soft p-10 text-center">
          <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">Sin ventas en este periodo.</p>
          <Link
            href="/pos"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            Ir al POS →
          </Link>
        </div>
      )}

      {/* Accesos de administración (solo dueño, no admin) */}
      {rol === 'dueno' || !rol ? (
        <div className="card-soft p-6">
          <h3 className="eyebrow mb-4">Administración</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AccesoAdmin
              href="/finanzas"
              Icon={BarChart2}
              label="Finanzas"
              sub="Utilidad y punto de equilibrio"
            />
            <AccesoAdmin
              href="/reportes"
              Icon={FileText}
              label="Reportes"
              sub="Ventas, gastos e inventario"
            />
            <AccesoAdmin
              href="/turnos"
              Icon={Clock}
              label="Turnos"
              sub="Cortes de todos los cajeros"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Componentes auxiliares ─────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
  empty = false,
}: {
  label: string
  value: string
  sub: string
  accent: 'primary' | 'emerald' | 'red' | 'default'
  empty?: boolean
}) {
  const valueClass = {
    primary: 'num-neutral text-primary',
    emerald: 'num-income',
    red: 'num-expense',
    default: 'num-neutral',
  }[accent]

  return (
    <div className={cn('card-soft p-4 sm:p-5', accent === 'primary' && 'bg-primary/[0.04]')}>
      <p className="eyebrow mb-1.5 text-[10px] sm:text-xs">{label}</p>
      <p className={cn('text-lg font-black tracking-tight leading-tight sm:text-2xl', valueClass, empty && 'opacity-40')}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
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
    <div className="card-soft p-6">
      <h3 className="eyebrow mb-5">{titulo}</h3>
      <div className="space-y-4">
        {productos.map((p, i) => (
          <div key={i}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="mr-2 flex-1 truncate text-sm font-medium">{p.nombre}</span>
              <span className="shrink-0 text-sm font-bold text-primary">{formatVal(p)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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

function AccesoRapido({
  href,
  Icon,
  label,
  sub,
}: {
  href: string
  Icon: React.FC<{ className?: string }>
  label: string
  sub: string
}) {
  return (
    <Link
      href={href}
      className="card-soft flex flex-col items-start gap-2 p-4 hover:bg-accent transition-colors"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </Link>
  )
}

function AccesoAdmin({
  href,
  Icon,
  label,
  sub,
}: {
  href: string
  Icon: React.FC<{ className?: string }>
  label: string
  sub: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border px-4 py-3.5 hover:bg-accent transition-colors"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50" />
    </Link>
  )
}
