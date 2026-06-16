import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Download,
  TrendingUp, TrendingDown, Scale,
  AlertTriangle, Package, User,
  ArrowUpRight, ArrowDownRight, Minus as MinusIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { formatMXN } from '@/lib/dinero'
import { mexicoDayRange } from '@/lib/fecha'
import { cn } from '@/lib/utils'
import { DonutEgresos, BarrasSeisM, DiasSemanaChart, type DonutSlice, type MesBar, type DiaSemana } from './finanzas-charts'
import PresupuestoCell from './presupuesto-form'

// ── Helpers ────────────────────────────────────────────────────────────────────

function hoyYM(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })
    .format(new Date()).slice(0, 7)
}
function mesLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const mes = new Intl.DateTimeFormat('es-MX', { month: 'long' })
    .format(new Date(Date.UTC(y, m - 1, 15)))
  return `${mes.charAt(0).toUpperCase() + mes.slice(1)} de ${y}`
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
function mesRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const lastDate = new Date(Date.UTC(y, m, 0))
  const lastDay = `${ym}-${String(lastDate.getUTCDate()).padStart(2, '0')}`
  return {
    start:     mexicoDayRange(`${ym}-01`).start,
    end:       mexicoDayRange(lastDay).end,
    startDate: `${ym}-01`,
    endDate:   lastDay,
    diasTotal: lastDate.getUTCDate(),
  }
}
function diasTranscurridos(ym: string): number {
  const hoy = hoyYM()
  if (ym !== hoy) return mesRange(ym).diasTotal
  return parseInt(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })
      .format(new Date()).slice(8, 10),
    10,
  )
}
const DIAS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

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
  const mesActual = /^\d{4}-\d{4,}/.test(mesParam ?? '') || /^\d{4}-\d{2}$/.test(mesParam ?? '')
    ? mesParam!
    : hoyYM()
  // Validate format
  const mesNorm = /^\d{4}-\d{2}$/.test(mesActual) ? mesActual : hoyYM()

  const rango     = mesRange(mesNorm)
  const rangoPrev = mesRange(prevMes(mesNorm))
  const diasMes   = diasTranscurridos(mesNorm)
  const supabase  = await createClient()

  // ── Queries ────────────────────────────────────────────────────────────────
  const [
    { data: ventasMes },
    { data: ventasMesAnt },
    { data: gastosMes },
    { data: gastosMesAnt },
    { data: categorias },
    { data: itemsMes },
    { data: allProductos },
  ] = await Promise.all([
    supabase.from('ventas')
      .select('total, created_at')
      .eq('negocio_id', negocio.id).eq('estado', 'completada')
      .gte('created_at', rango.start).lte('created_at', rango.end),

    supabase.from('ventas')
      .select('total')
      .eq('negocio_id', negocio.id).eq('estado', 'completada')
      .gte('created_at', rangoPrev.start).lte('created_at', rangoPrev.end),

    supabase.from('gastos')
      .select('monto, es_personal, categoria_id, categorias_gasto(nombre)')
      .eq('negocio_id', negocio.id)
      .gte('fecha', rango.startDate).lte('fecha', rango.endDate),

    supabase.from('gastos')
      .select('monto, es_personal')
      .eq('negocio_id', negocio.id)
      .gte('fecha', rangoPrev.startDate).lte('fecha', rangoPrev.endDate),

    supabase.from('categorias_gasto')
      .select('id, nombre, presupuesto')
      .eq('negocio_id', negocio.id).order('nombre'),

    supabase.from('venta_items')
      .select('cantidad, subtotal, producto_id, productos(nombre, precio_costo), ventas!inner(created_at, estado)')
      .eq('ventas.estado', 'completada')
      .gte('ventas.created_at', rango.start).lte('ventas.created_at', rango.end),

    supabase.from('productos')
      .select('id, nombre, existencias, precio_costo')
      .eq('negocio_id', negocio.id).eq('activo', true),
  ])

  // ── 6-month chart (2 extra queries) ────────────────────────────────────────
  const [y0, m0] = mesNorm.split('-').map(Number)
  const d5ago = new Date(Date.UTC(y0, m0 - 6, 1))
  const r5start = mexicoDayRange(
    `${d5ago.getUTCFullYear()}-${String(d5ago.getUTCMonth() + 1).padStart(2, '0')}-01`
  ).start
  const r5end = mexicoDayRange(`${mesNorm}-01`).start

  const [{ data: ventasPast }, { data: gastosPast }] = await Promise.all([
    supabase.from('ventas').select('total, created_at')
      .eq('negocio_id', negocio.id).eq('estado', 'completada')
      .gte('created_at', r5start).lt('created_at', r5end),
    supabase.from('gastos').select('monto, es_personal, fecha')
      .eq('negocio_id', negocio.id)
      .gte('fecha', `${d5ago.getUTCFullYear()}-${String(d5ago.getUTCMonth() + 1).padStart(2, '0')}-01`)
      .lt('fecha', `${mesNorm}-01`),
  ])

  // ── KPIs base ──────────────────────────────────────────────────────────────
  const ingresosMes   = (ventasMes  ?? []).reduce((s, v) => s + v.total, 0)
  const ingresosPrev  = (ventasMesAnt ?? []).reduce((s, v) => s + v.total, 0)
  const egresosMes    = (gastosMes  ?? []).filter(g => !g.es_personal).reduce((s, g) => s + g.monto, 0)
  const egresosPrev   = (gastosMesAnt ?? []).filter(g => !g.es_personal).reduce((s, g) => s + g.monto, 0)
  const retirosMes    = (gastosMes  ?? []).filter(g => g.es_personal).reduce((s, g) => s + g.monto, 0)
  const balanceMes    = ingresosMes - egresosMes
  const numVentas     = ventasMes?.length ?? 0
  const ticketPromedio = numVentas > 0 ? Math.round(ingresosMes / numVentas) : 0

  // ── Costo de ventas / margen bruto ─────────────────────────────────────────
  const costoVentas = (itemsMes ?? []).reduce((s, item) => {
    const pc = (item.productos as unknown as { precio_costo: number | null } | null)?.precio_costo ?? 0
    return s + item.cantidad * pc
  }, 0)
  const hayCostos = costoVentas > 0
  const margenBruto = ingresosMes - costoVentas
  const margenBrutoPct = ingresosMes > 0 ? Math.round((margenBruto / ingresosMes) * 100) : null

  // ── Punto de equilibrio ────────────────────────────────────────────────────
  const promedioDialio = diasMes > 0 ? Math.round(ingresosMes / diasMes) : 0
  // Si hay márgenes: necesitas vender (gasto diario / margen%) para cubrir gastos
  // Si no: solo divide egresos / días del mes
  const gastosDiario = Math.round(egresosMes / rango.diasTotal)
  const breakEvenDiario = hayCostos && margenBrutoPct && margenBrutoPct > 0
    ? Math.round(gastosDiario / (margenBrutoPct / 100))
    : gastosDiario
  const superaBreakEven = promedioDialio >= breakEvenDiario

  // ── Crecimiento vs mes anterior ────────────────────────────────────────────
  const hasPrevData = ingresosPrev > 0
  const crecimientoPct = hasPrevData
    ? Math.round(((ingresosMes - ingresosPrev) / ingresosPrev) * 100)
    : null
  const crecimientoDelta = ingresosMes - ingresosPrev

  // ── Gastos sobre ventas ────────────────────────────────────────────────────
  const gastosSobreVentasPct = ingresosMes > 0
    ? Math.round((egresosMes / ingresosMes) * 100)
    : null

  // ── Semáforo ───────────────────────────────────────────────────────────────
  type Semaforo = 'verde' | 'amarillo' | 'rojo'
  const margenNetoPct = ingresosMes > 0 ? (balanceMes / ingresosMes) * 100 : 0
  const semaforo: Semaforo =
    balanceMes < 0 ? 'rojo' :
    (margenNetoPct < 15 || (hasPrevData && ingresosMes < ingresosPrev)) ? 'amarillo' :
    'verde'

  const mayorGasto = (gastosMes ?? [])
    .filter(g => !g.es_personal)
    .sort((a, b) => b.monto - a.monto)[0]
  const mayorGastoNombre = (mayorGasto?.categorias_gasto as unknown as { nombre: string } | null)?.nombre ?? ''

  const semaforoData = {
    verde: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40',
      dot: 'bg-emerald-500',
      titulo: 'Vas bien',
      mensaje: `Este mes llevas ${formatMXN(ingresosMes)} de ventas y ${formatMXN(egresosMes)} de gastos. Te quedan ${formatMXN(balanceMes)} de utilidad.${mayorGastoNombre ? ` Tu mayor gasto es ${mayorGastoNombre}.` : ''}${hasPrevData ? ` Tus ventas van ${crecimientoPct! >= 0 ? 'arriba' : 'abajo'} ${Math.abs(crecimientoPct!)}% vs el mes pasado.` : ''}`,
    },
    amarillo: {
      bg: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800/40',
      dot: 'bg-yellow-500',
      titulo: 'Cuidado, está apretado',
      mensaje: `Tienes ${formatMXN(balanceMes)} de balance${margenNetoPct < 15 ? `, que es solo el ${Math.round(margenNetoPct)}% de lo que vendes — muy poquito margen` : ''}.${hasPrevData && ingresosMes < ingresosPrev ? ` Tus ventas bajaron ${Math.abs(crecimientoPct!)}% vs el mes pasado (${formatMXN(ingresosPrev)}).` : ''}${mayorGastoNombre ? ` Revisa el gasto de ${mayorGastoNombre}.` : ''}`,
    },
    rojo: {
      bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40',
      dot: 'bg-red-500',
      titulo: 'Estás perdiendo dinero',
      mensaje: `Tus gastos (${formatMXN(egresosMes)}) son más que tus ventas (${formatMXN(ingresosMes)}). Estás perdiendo ${formatMXN(Math.abs(balanceMes))} este mes.${mayorGastoNombre ? ` El gasto más pesado es ${mayorGastoNombre}.` : ''} Necesitas aumentar ventas o bajar gastos urgente.`,
    },
  }
  const sd = semaforoData[semaforo]

  // ── Mejores días de la semana ──────────────────────────────────────────────
  const dowMap = new Map<number, number>()
  for (const v of ventasMes ?? []) {
    const dow = new Date(v.created_at).toLocaleDateString('en-US', {
      timeZone: 'America/Mexico_City', weekday: 'short',
    })
    // convert to 0-6 (Sun-Sat)
    const d = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dow)
    if (d >= 0) dowMap.set(d, (dowMap.get(d) ?? 0) + v.total)
  }
  const diasSemana: DiaSemana[] = DIAS_ES.map((label, i) => ({
    dia: label,
    total: dowMap.get(i) ?? 0,
    tickets: 0,
  }))
  const mejorDia = [...diasSemana].sort((a, b) => b.total - a.total)[0]

  // ── Valor del inventario a costo ───────────────────────────────────────────
  const inventarioValor = (allProductos ?? []).reduce(
    (s, p) => s + p.existencias * (p.precio_costo ?? 0), 0,
  )

  // ── Productos sin movimiento (0 ventas en el mes) ──────────────────────────
  const vendidosIds = new Set((itemsMes ?? []).map(i => i.producto_id))
  const sinMovimiento = (allProductos ?? [])
    .filter(p => !vendidosIds.has(p.id))
    .sort((a, b) =>
      (b.existencias * (b.precio_costo ?? 0)) - (a.existencias * (a.precio_costo ?? 0)),
    )
    .slice(0, 8)

  // ── Egresos por categoría ──────────────────────────────────────────────────
  type CatEgreso = { id: string; nombre: string; presupuesto: number | null; real: number }
  const catMap = new Map<string, CatEgreso>()
  for (const cat of categorias ?? []) {
    catMap.set(cat.id, { id: cat.id, nombre: cat.nombre, presupuesto: cat.presupuesto ?? null, real: 0 })
  }
  for (const g of gastosMes ?? []) {
    if (g.es_personal) continue
    const e = catMap.get(g.categoria_id)
    if (e) e.real += g.monto
  }
  const egresosXCat = [...catMap.values()]
    .filter(c => c.real > 0 || c.presupuesto)
    .sort((a, b) => b.real - a.real)
  const donutData: DonutSlice[] = egresosXCat.filter(c => c.real > 0).map(c => ({ nombre: c.nombre, monto: c.real }))

  // ── 6-month chart ──────────────────────────────────────────────────────────
  const seisM: MesBar[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y0, m0 - 1 - i, 1))
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const label = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 15))
      .toLocaleDateString('es-MX', { timeZone: 'UTC', month: 'short' })
    if (i === 0) {
      seisM.push({ mes: label, ingresos: ingresosMes, egresos: egresosMes })
    } else {
      const v = (ventasPast ?? [])
        .filter(v => new Date(v.created_at).toISOString().startsWith(ym.replace('-', '-').slice(0, 7)))
        .reduce((s, v) => s + v.total, 0)
      const g = (gastosPast ?? [])
        .filter(g => !g.es_personal && (g.fecha as string).startsWith(ym))
        .reduce((s, g) => s + g.monto, 0)
      seisM.push({ mes: label, ingresos: v, egresos: g })
    }
  }

  // ── Top 10 por ganancia ────────────────────────────────────────────────────
  type PG = { nombre: string; unidades: number; ganancia: number }
  const pmap = new Map<string, PG>()
  for (const item of itemsMes ?? []) {
    const prod = item.productos as unknown as { nombre: string; precio_costo: number | null } | null
    const nombre = prod?.nombre ?? 'Eliminado'
    const pc = prod?.precio_costo ?? 0
    const pv = item.subtotal / item.cantidad
    const e = pmap.get(item.producto_id) ?? { nombre, unidades: 0, ganancia: 0 }
    e.unidades += item.cantidad
    e.ganancia += (pv - pc) * item.cantidad
    pmap.set(item.producto_id, e)
  }
  const top10 = [...pmap.values()].filter(p => p.ganancia > 0).sort((a, b) => b.ganancia - a.ganancia).slice(0, 10)

  const isCurrentMonth = mesNorm === hoyYM()
  const canGoNext = !isCurrentMonth

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black tracking-tight">Finanzas</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/finanzas?mes=${prevMes(mesNorm)}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[150px] text-center text-sm font-semibold">
            {mesLabel(mesNorm)}
          </span>
          <Link href={canGoNext ? `/finanzas?mes=${nextMes(mesNorm)}` : '#'}
            className={cn('flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
              canGoNext ? 'hover:bg-accent' : 'opacity-30 pointer-events-none')}>
            <ChevronRight className="h-4 w-4" />
          </Link>
          <a href={`/api/export/finanzas?mes=${mesNorm}`}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
            <Download className="h-4 w-4" />
            Excel
          </a>
        </div>
      </div>

      {/* ── 1. Semáforo ── */}
      <div className={cn('rounded-2xl border p-7', sd.bg)}>
        <div className="flex items-start gap-3">
          <span className={cn('mt-1.5 h-3 w-3 shrink-0 rounded-full', sd.dot)} />
          <div>
            <p className="text-xl font-black tracking-tight">{sd.titulo}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{sd.mensaje}</p>
          </div>
        </div>
      </div>

      {/* ── 2. Punto de equilibrio ── */}
      <div className="card-soft p-6">
        <p className="text-sm font-semibold mb-1">Punto de equilibrio diario</p>
        <p className="text-xs text-muted-foreground mb-4">
          {hayCostos
            ? 'Con tu margen de ganancia, necesitas vender esta cantidad al día solo para cubrir gastos.'
            : 'Divide tus gastos del mes entre los días. Así sabes cuánto necesitas vender cada día.'}
        </p>
        <div className="flex flex-wrap items-start gap-4">
          <div className="text-center">
            <p className="text-3xl font-black tracking-tight text-primary">{formatMXN(breakEvenDiario)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">necesitas al día</p>
          </div>
          <div className={cn('flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium',
            superaBreakEven
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')}>
            {superaBreakEven
              ? <ArrowUpRight className="h-4 w-4" />
              : <ArrowDownRight className="h-4 w-4" />}
            <span>
              Tu promedio diario es {formatMXN(promedioDialio)} —{' '}
              {superaBreakEven ? 'estás por encima, bien' : 'estás por debajo de la meta'}
            </span>
          </div>
          {hayCostos && margenBrutoPct !== null && (
            <p className="text-xs text-muted-foreground">
              (calculado con tu margen bruto de {margenBrutoPct}%)
            </p>
          )}
        </div>
      </div>

      {/* ── 3. KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-soft p-6">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="eyebrow">Ingresos</span>
          </div>
          <p className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">{formatMXN(ingresosMes)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{numVentas} ventas · ticket promedio {formatMXN(ticketPromedio)}</p>
        </div>

        <div className="card-soft p-6">
          <div className="mb-2 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <span className="eyebrow">Egresos del negocio</span>
          </div>
          <p className="text-3xl font-black tracking-tight text-red-600 dark:text-red-400">{formatMXN(egresosMes)}</p>
          {egresosPrev > 0 && (
            <p className={cn('mt-1 text-xs font-medium', egresosMes > egresosPrev ? 'text-red-500' : 'text-emerald-600')}>
              {egresosMes > egresosPrev ? '↑' : '↓'} {Math.abs(Math.round(((egresosMes - egresosPrev) / egresosPrev) * 100))}% vs mes anterior
            </p>
          )}
        </div>

        <div className={cn('card-soft p-6',
          balanceMes >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-red-50 dark:bg-red-950/20')}>
          <div className="mb-2 flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <span className="eyebrow">Balance</span>
          </div>
          <p className={cn('text-3xl font-bold', balanceMes >= 0
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-red-700 dark:text-red-300')}>
            {formatMXN(balanceMes)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ingresosMes > 0 ? `${Math.round(margenNetoPct)}% de lo que vendes se convierte en ganancia` : 'Sin ventas'}
          </p>
        </div>
      </div>

      {/* ── 4. Métricas nuevas — fila 1 ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Crecimiento */}
        <div className="card-soft p-6">
          <p className="eyebrow mb-2">Crecimiento vs mes anterior</p>
          {crecimientoPct !== null ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className={cn('text-2xl font-black tracking-tight',
                  crecimientoPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                  {crecimientoPct >= 0 ? '+' : ''}{crecimientoPct}%
                </span>
                {crecimientoPct >= 0
                  ? <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  : <ArrowDownRight className="h-4 w-4 text-red-500" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {crecimientoDelta >= 0 ? '+' : ''}{formatMXN(crecimientoDelta)} vs {formatMXN(ingresosPrev)} del mes anterior
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos del mes anterior para comparar</p>
          )}
        </div>

        {/* Margen bruto */}
        <div className="card-soft p-6">
          <p className="eyebrow mb-2">Margen bruto</p>
          {margenBrutoPct !== null ? (
            <>
              <p className="text-2xl font-black tracking-tight text-primary">{margenBrutoPct}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                De cada $100 que vendes, te quedan <strong>${margenBrutoPct}</strong> antes de pagar gastos fijos
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Agrega el precio de costo a tus productos para ver este número
            </p>
          )}
        </div>

        {/* Gastos sobre ventas */}
        <div className="card-soft p-6">
          <p className="eyebrow mb-2">Gastos sobre ventas</p>
          {gastosSobreVentasPct !== null ? (
            <>
              <p className={cn('text-2xl font-black tracking-tight',
                gastosSobreVentasPct > 85 ? 'text-red-600 dark:text-red-400' :
                gastosSobreVentasPct > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-emerald-600 dark:text-emerald-400')}>
                {gastosSobreVentasPct}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                De cada $100 que vendes, <strong className={gastosSobreVentasPct > 85 ? 'text-red-500' : ''}>
                  ${gastosSobreVentasPct} se van en gastos
                </strong>
                {gastosSobreVentasPct > 85 && ' — demasiado alto'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sin ventas este mes</p>
          )}
        </div>
      </div>

      {/* ── 4b. Métricas nuevas — fila 2 ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Mejores días */}
        <div className="card-soft p-6">
          <p className="eyebrow mb-1">Ventas por día de la semana</p>
          {mejorDia && mejorDia.total > 0 && (
            <p className="text-xs text-muted-foreground mb-2">
              Tu mejor día es <strong>{mejorDia.dia}</strong> con {formatMXN(mejorDia.total)} acumulados
            </p>
          )}
          <DiasSemanaChart data={diasSemana} />
        </div>

        {/* Inventario a costo */}
        <div className="card-soft p-6">
          <p className="eyebrow mb-2">Valor del inventario</p>
          {inventarioValor > 0 ? (
            <>
              <p className="text-2xl font-black tracking-tight">{formatMXN(inventarioValor)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tienes este dinero invertido en mercancía en tu estante. A precio de costo.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Agrega precio de costo a tus productos para ver el valor del inventario
            </p>
          )}
        </div>

        {/* Productos sin movimiento */}
        <div className="card-soft p-6">
          <p className="eyebrow mb-2">
            Productos parados este mes ({sinMovimiento.length})
          </p>
          {sinMovimiento.length === 0 ? (
            <p className="text-sm text-emerald-600">¡Todos tus productos se vendieron este mes!</p>
          ) : (
            <div className="space-y-1.5">
              {sinMovimiento.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium truncate flex-1">{p.nombre}</p>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {p.existencias} uds
                      {p.precio_costo ? ` · ${formatMXN(p.existencias * p.precio_costo)} parados` : ''}
                    </p>
                  </div>
                </div>
              ))}
              {sinMovimiento.length > 5 && (
                <p className="text-xs text-muted-foreground">+{sinMovimiento.length - 5} más</p>
              )}
              <p className="text-xs text-muted-foreground border-t pt-1.5 mt-1">
                Este dinero está parado en tu estante, no genera ganancia.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Egresos por categoría + Donut ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 card-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60">
            <p className="eyebrow mb-1">Egresos por categoría</p>
            <p className="text-xs text-muted-foreground">
              Escribe un presupuesto y presiona Enter o Tab para guardarlo. Rojo = se pasó del presupuesto.
            </p>
          </div>
          {egresosXCat.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Sin egresos este mes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                    <th className="px-4 py-2 text-left">Categoría</th>
                    <th className="px-4 py-2 text-right">Presupuesto</th>
                    <th className="px-4 py-2 text-right">Real</th>
                    <th className="px-4 py-2 text-right w-16">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {egresosXCat.map((c) => {
                    const sobre = !!c.presupuesto && c.real > c.presupuesto
                    const pct   = c.presupuesto ? Math.round((c.real / c.presupuesto) * 100) : null
                    return (
                      <tr key={c.id} className={cn(sobre && 'bg-red-50/60 dark:bg-red-950/20')}>
                        <td className="px-4 py-2.5 font-medium">{c.nombre}</td>
                        <td className="px-4 py-2.5 text-right">
                          <PresupuestoCell categoriaId={c.id} presupuestoActual={c.presupuesto} />
                        </td>
                        <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums',
                          sobre ? 'text-destructive' : '')}>
                          {formatMXN(c.real)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                          {pct !== null
                            ? <span className={cn('font-semibold', sobre ? 'text-destructive' : 'text-muted-foreground')}>{pct}%</span>
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 card-soft p-6">
          <p className="eyebrow mb-3">Distribución de egresos</p>
          <DonutEgresos data={donutData} />
          <div className="mt-2 space-y-1">
            {donutData.slice(0, 5).map((d, i) => (
              <div key={d.nombre} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{
                  backgroundColor: ['var(--color-chart-1)','var(--color-chart-2)','var(--color-chart-3)','var(--color-chart-4)','var(--color-chart-5)'][i],
                }} />
                <span className="flex-1 truncate text-muted-foreground">{d.nombre}</span>
                <span className="font-medium tabular-nums">{formatMXN(d.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 6. Barras 6 meses ── */}
      <div className="card-soft p-6 sm:p-7">
        <p className="eyebrow mb-1">Ingresos vs Egresos — últimos 6 meses</p>
        <p className="mb-5 text-xs text-muted-foreground">Compara cómo ha ido tu negocio mes a mes.</p>
        <BarrasSeisM data={seisM} />
      </div>

      {/* ── 7. Top 10 por ganancia ── */}
      {top10.length > 0 && (
        <div className="card-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60">
            <p className="eyebrow mb-1">Productos que más te dejan</p>
            <p className="text-xs text-muted-foreground">Ganancia = unidades vendidas × (precio de venta − precio de costo)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Producto</th>
                  <th className="px-4 py-2 text-right">Uds</th>
                  <th className="px-4 py-2 text-right">Ganancia</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {top10.map((p, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium max-w-[160px] truncate">{p.nombre}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{p.unidades}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatMXN(p.ganancia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 8. Retiros personales ── */}
      {retirosMes > 0 && (
        <div className="card-soft flex items-center gap-4 px-6 py-5">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Retiros personales del dueño</p>
            <p className="text-xs text-muted-foreground">
              Este dinero lo sacaste para uso personal. No está incluido en los egresos del negocio.
            </p>
          </div>
          <p className="text-xl font-black tracking-tight text-orange-500 tabular-nums shrink-0">{formatMXN(retirosMes)}</p>
        </div>
      )}

    </div>
  )
}
