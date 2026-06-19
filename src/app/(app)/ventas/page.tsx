import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Printer, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { getRango, PERIODOS, type Periodo } from '@/lib/periodo'
import { fmtHora, fmtFechaCorta, TZ, addDaysMX, hoyMX } from '@/lib/fecha'
import { cn } from '@/lib/utils'
import EmpleadoSelect from './filtros-client'

type Venta = {
  id: string
  total: number
  pago_recibido: number
  cambio: number
  created_at: string
  estado: string
  vendedor_id: string | null
  metodos_pago: { nombre: string } | null
}

type Miembro = { user_id: string; email: string; rol: string }

function fechaKeyMX(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso))
}

function groupByDate(lista: Venta[]): Map<string, Venta[]> {
  const map = new Map<string, Venta[]>()
  for (const v of lista) {
    const k = fechaKeyMX(v.created_at)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(v)
  }
  return map
}

function labelDiaLargo(fechaYMD: string): string {
  return new Date(fechaYMD + 'T12:00:00Z').toLocaleDateString('es-MX', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function VentaRow({ venta, showDate = false }: { venta: Venta; showDate?: boolean }) {
  const metodoPago = (venta.metodos_pago as { nombre: string } | null)?.nombre ?? '—'
  return (
    <Link
      href={`/ventas/${venta.id}`}
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent',
        venta.estado === 'cancelada' && 'opacity-50',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{fmtHora(venta.created_at)}</span>
          {showDate && (
            <span className="text-xs text-muted-foreground">{fmtFechaCorta(venta.created_at)}</span>
          )}
          {venta.estado === 'cancelada' && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              Cancelada
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{metodoPago}</p>
      </div>
      <span className="font-bold text-green-600 shrink-0">{formatMXN(venta.total)}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  )
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string; vendedor?: string }>
}) {
  const { p = 'hoy', desde, hasta, vendedor } = await searchParams
  const periodo = p as Periodo

  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rango = getRango(periodo, desde, hasta)
  const supabase = await createClient()

  // Fetch team members — only works for dueño; silently empty for employees
  const { data: miembrosRaw } = await supabase.rpc('get_miembros_negocio', {
    p_negocio_id: negocio.id,
  })
  const miembros = (miembrosRaw ?? []) as Miembro[]

  // Ventas query
  const baseQuery = supabase
    .from('ventas')
    .select('id, total, pago_recibido, cambio, created_at, estado, vendedor_id, metodos_pago(nombre)')
    .eq('negocio_id', negocio.id)
    .gte('created_at', rango.start)
    .lte('created_at', rango.end)
    .order('created_at', { ascending: false })

  const { data: ventas } = await (vendedor && vendedor !== 'todos'
    ? baseQuery.eq('vendedor_id', vendedor)
    : baseQuery)

  const lista = (ventas ?? []) as unknown as Venta[]
  const completadas = lista.filter((v) => v.estado === 'completada')
  const totalRecaudado = completadas.reduce((s, v) => s + v.total, 0)
  const numVentas = completadas.length

  function periodoUrl(v: string) {
    const params = new URLSearchParams({ p: v })
    if (vendedor && vendedor !== 'todos') params.set('vendedor', vendedor)
    return `/ventas?${params.toString()}`
  }

  // ── Semana: 7-day grouped view ────────────────────────────────
  function renderSemana() {
    const grupos = groupByDate(lista)
    const dias = Array.from({ length: 7 }, (_, i) => addDaysMX(rango.startDate, i))

    return (
      <div className="space-y-3">
        {dias.map((dia) => {
          const ventasDia = grupos.get(dia) ?? []
          const completadasDia = ventasDia.filter((v) => v.estado === 'completada')
          const totalDia = completadasDia.reduce((s, v) => s + v.total, 0)

          return (
            <div key={dia} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
                <span className="text-sm font-semibold capitalize">{labelDiaLargo(dia)}</span>
                {completadasDia.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {completadasDia.length} venta{completadasDia.length !== 1 ? 's' : ''}
                    </span>
                    <span className="font-bold text-green-600 text-sm">{formatMXN(totalDia)}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Sin ventas</span>
                )}
              </div>
              {ventasDia.length > 0 && (
                <div className="divide-y">
                  {ventasDia.map((venta) => (
                    <VentaRow key={venta.id} venta={venta} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Mes: calendar grid ────────────────────────────────────────
  function renderMes() {
    const hoy = hoyMX()
    const grupos = groupByDate(lista)
    const [year, month] = rango.startDate.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const firstDate = new Date(
      `${year}-${String(month).padStart(2, '0')}-01T12:00:00Z`,
    )
    const firstWeekday = (firstDate.getDay() + 6) % 7 // Mon=0

    const leading = Array(firstWeekday).fill(null) as null[]
    const dayNums = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    const cells: (number | null)[] = [...leading, ...dayNums]
    while (cells.length % 7 !== 0) cells.push(null)

    const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

    return (
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden p-3">
        <div className="grid grid-cols-7 mb-1">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-medium text-muted-foreground py-1"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="h-14" />

            const fecha = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const ventasDia = (grupos.get(fecha) ?? []).filter(
              (v) => v.estado === 'completada',
            )
            const totalDia = ventasDia.reduce((s, v) => s + v.total, 0)
            const esHoy = fecha === hoy
            const esFuturo = fecha > hoy
            const hayVentas = ventasDia.length > 0

            const baseClass = cn(
              'h-14 rounded-lg p-1 flex flex-col items-center justify-start',
              esHoy && 'ring-2 ring-primary ring-offset-1',
            )

            if (esFuturo || !hayVentas) {
              return (
                <div
                  key={i}
                  className={cn(baseClass, esFuturo ? 'text-muted-foreground/30' : 'text-muted-foreground/50')}
                >
                  <span className="text-xs font-medium mt-0.5">{day}</span>
                </div>
              )
            }

            const diaParams = new URLSearchParams({ p: 'rango', desde: fecha, hasta: fecha })
            if (vendedor && vendedor !== 'todos') diaParams.set('vendedor', vendedor)

            return (
              <Link
                key={i}
                href={`/ventas?${diaParams.toString()}`}
                className={cn(
                  baseClass,
                  'bg-primary/5 hover:bg-primary/10 transition-colors',
                )}
              >
                <span className="text-xs font-medium mt-0.5">{day}</span>
                <span className="text-[10px] font-bold text-green-600 leading-tight">
                  {formatMXN(totalDia)}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {ventasDia.length}v
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Flat list (hoy / rango) ───────────────────────────────────
  function renderLista(showDate = false) {
    if (lista.length === 0) {
      return (
        <div className="mt-12 text-center text-muted-foreground">
          <p className="text-lg">Sin ventas en este periodo.</p>
          <Link
            href="/pos"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            Ir al POS →
          </Link>
        </div>
      )
    }
    return (
      <div className="divide-y rounded-xl border bg-card shadow-sm overflow-hidden">
        {lista.map((venta) => (
          <VentaRow key={venta.id} venta={venta} showDate={showDate} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Historial de ventas</h1>

      {/* Botones exportar / imprimir */}
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href="/api/export/ventas"
          className="ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4" />
          Excel
        </a>
        <Link
          href={`/ventas/reporte?p=${periodo}${desde ? `&desde=${desde}` : ''}${hasta ? `&hasta=${hasta}` : ''}`}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map(({ label, value }) => (
          <Link
            key={value}
            href={periodoUrl(value)}
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
          <form method="GET" action="/ventas" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="p" value="rango" />
            {vendedor && vendedor !== 'todos' && (
              <input type="hidden" name="vendedor" value={vendedor} />
            )}
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

        {miembros.length > 1 && (
          <EmpleadoSelect
            miembros={miembros}
            vendedor={vendedor ?? 'todos'}
            periodo={periodo}
            desde={desde}
            hasta={hasta}
          />
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total recaudado</p>
          <p className="mt-1 text-xl font-bold text-green-600">{formatMXN(totalRecaudado)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Ventas</p>
          <p className="mt-1 text-xl font-bold">{numVentas}</p>
        </div>
        {numVentas > 0 && (
          <div className="col-span-2 rounded-xl border bg-card p-4 shadow-sm sm:col-span-1">
            <p className="text-xs text-muted-foreground">Ticket promedio</p>
            <p className="mt-1 text-xl font-bold">
              {formatMXN(Math.round(totalRecaudado / numVentas))}
            </p>
          </div>
        )}
      </div>

      {/* Vista principal */}
      {periodo === 'semana' && renderSemana()}
      {periodo === 'mes' && renderMes()}
      {(periodo === 'hoy' || periodo === 'rango') && renderLista(periodo === 'rango')}
    </div>
  )
}
