import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MapPin, Settings2, TrendingUp, ShoppingCart, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { formatMXN } from '@/lib/dinero'
import { getRango, type Periodo } from '@/lib/periodo'
import { cn } from '@/lib/utils'

type SearchParams = Promise<{ p?: string }>

type PlazaRow = {
  local_id: string
  local_nombre: string
  local_color: string
  total_ventas: number
  num_ventas: number
  total_gastos: number
  num_cortes: number
}

const PERIODOS = [
  { label: 'Hoy', value: 'hoy' },
  { label: 'Semana', value: 'semana' },
  { label: 'Mes', value: 'mes' },
] as const

export default async function PlazasPage({ searchParams }: { searchParams: SearchParams }) {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol && rol !== 'dueno') redirect('/')

  const { p = 'hoy' } = await searchParams
  const periodo = p as Periodo
  const { start, end } = getRango(periodo)

  const supabase = await createClient()

  // Fetch locales activos + max_plazas para el check multi-plaza
  const [{ data: locales }, { data: negocioData }] = await Promise.all([
    supabase
      .from('locales')
      .select('id')
      .eq('negocio_id', negocio.id)
      .eq('activo', true),
    supabase
      .from('negocios')
      .select('max_plazas')
      .eq('id', negocio.id)
      .single(),
  ])

  const numLocales = locales?.length ?? 0
  const maxPlazas = negocioData?.max_plazas ?? 1
  const tieneMultiplasPlazas = numLocales > 1 || maxPlazas > 1

  // Fetch comparativo
  const { data: raw } = await supabase.rpc('get_ventas_por_plaza', {
    p_negocio_id: negocio.id,
    p_desde: start,
    p_hasta: end,
  })

  const plazas: PlazaRow[] = (raw ?? []).map((r: Record<string, unknown>) => ({
    local_id: r.local_id as string,
    local_nombre: r.local_nombre as string,
    local_color: r.local_color as string,
    total_ventas: Number(r.total_ventas ?? 0),
    num_ventas: Number(r.num_ventas ?? 0),
    total_gastos: Number(r.total_gastos ?? 0),
    num_cortes: Number(r.num_cortes ?? 0),
  }))

  const totalVentas = plazas.reduce((s, p) => s + p.total_ventas, 0)
  const totalGastos = plazas.reduce((s, p) => s + p.total_gastos, 0)
  const totalVentas1 = plazas[0]?.total_ventas ?? 1  // para barras proporcionales

  const periodoLabel = PERIODOS.find((p) => p.value === periodo)?.label ?? 'Hoy'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">Comparativo de plazas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Rendimiento por ubicación — {periodoLabel.toLowerCase()}
          </p>
        </div>
        <Link
          href="/configuracion/plazas"
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Gestionar
        </Link>
      </div>

      {/* Filtro de período */}
      <div className="flex gap-1.5">
        {PERIODOS.map(({ label, value }) => (
          <Link
            key={value}
            href={`/plazas?p=${value}`}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              periodo === value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Estado: sin múltiples plazas */}
      {!tieneMultiplasPlazas && (
        <div className="rounded-xl border-2 border-dashed border-border p-8 text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MapPin className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          <div>
            <p className="font-semibold">Solo tienes una plaza activa</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Agrega más plazas a tu licencia para comparar el rendimiento entre ubicaciones.
            </p>
          </div>
          <Link
            href="/configuracion/plazas"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <MapPin className="h-4 w-4" />
            Gestionar plazas
          </Link>
        </div>
      )}

      {/* Tabla comparativa */}
      {tieneMultiplasPlazas && plazas.length > 0 && (
        <div className="space-y-3">
          {plazas.map((plaza, idx) => {
            const pct = totalVentas1 > 0 ? Math.round((plaza.total_ventas / totalVentas1) * 100) : 0
            const utilidad = plaza.total_ventas - plaza.total_gastos
            return (
              <div key={plaza.local_id} className="card-soft p-4 space-y-3">
                {/* Nombre y posición */}
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: plaza.local_color }}
                  />
                  <p className="font-semibold text-sm flex-1">{plaza.local_nombre}</p>
                  {idx === 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      <TrendingUp className="h-2.5 w-2.5" />
                      #1
                    </span>
                  )}
                </div>

                {/* Barra de ventas */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Ventas</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatMXN(plaza.total_ventas)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: plaza.local_color }}
                    />
                  </div>
                </div>

                {/* KPIs secundarios */}
                <div className="grid grid-cols-3 gap-2">
                  <KpiMini
                    Icon={ShoppingCart}
                    label="Ventas"
                    value={String(plaza.num_ventas)}
                    sub="transacciones"
                  />
                  <KpiMini
                    Icon={Receipt}
                    label="Gastos"
                    value={formatMXN(plaza.total_gastos)}
                    color={plaza.total_gastos > 0 ? 'text-destructive' : undefined}
                  />
                  <KpiMini
                    Icon={TrendingUp}
                    label="Utilidad"
                    value={formatMXN(utilidad)}
                    color={utilidad >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}
                  />
                </div>
              </div>
            )
          })}

          {/* Fila totales */}
          {plazas.length > 1 && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total consolidado
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Ventas</p>
                  <p className="font-black tabular-nums">{formatMXN(totalVentas)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gastos</p>
                  <p className="font-black tabular-nums text-destructive">{formatMXN(totalGastos)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Utilidad</p>
                  <p className={cn(
                    'font-black tabular-nums',
                    totalVentas - totalGastos >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                  )}>
                    {formatMXN(totalVentas - totalGastos)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sin datos */}
      {tieneMultiplasPlazas && plazas.length === 0 && (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          Sin datos para este período.
        </div>
      )}
    </div>
  )
}

function KpiMini({
  Icon,
  label,
  value,
  sub,
  color,
}: {
  Icon: React.FC<{ className?: string }>
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-lg bg-background/60 px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className={cn('text-sm font-bold tabular-nums truncate', color)}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
