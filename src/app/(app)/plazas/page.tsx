import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  MapPin, Settings2, TrendingUp, ShoppingCart, Receipt, Package, Users,
  ChevronRight, Warehouse,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { requireModulo } from '@/lib/modulos'
import { getRolActual } from '@/lib/rol'
import { formatMXN } from '@/lib/dinero'
import { getRango, type Periodo } from '@/lib/periodo'
import { cn } from '@/lib/utils'

type SearchParams = Promise<{ p?: string }>

type VentasPlazaRow = {
  local_id: string
  total_ventas: number
  num_ventas: number
  total_gastos: number
}

const PERIODOS = [
  { label: 'Hoy', value: 'hoy' },
  { label: 'Semana', value: 'semana' },
  { label: 'Mes', value: 'mes' },
] as const

export default async function PlazasPage({ searchParams }: { searchParams: SearchParams }) {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  await requireModulo('multi_plaza')

  const rol = await getRolActual()
  if (rol && rol !== 'dueno') redirect('/')

  const { p = 'hoy' } = await searchParams
  const periodo = p as Periodo
  const { start, end } = getRango(periodo)

  const supabase = await createClient()

  const [
    { data: locales },
    { data: comparativo },
    { data: ventasPool },
    { data: asignaciones },
  ] = await Promise.all([
    // La primera plaza creada (la "principal") va primero
    supabase
      .from('locales')
      .select('id, nombre, direccion, color, activo, created_at')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('created_at', { ascending: true }),
    supabase.rpc('get_ventas_por_plaza', {
      p_negocio_id: negocio.id,
      p_desde: start,
      p_hasta: end,
    }),
    // Ventas sin plaza (pool general: bodega/casa o dueño vendiendo sin plaza)
    supabase
      .from('ventas')
      .select('total')
      .eq('negocio_id', negocio.id)
      .eq('estado', 'completada')
      .is('local_id', null)
      .gte('created_at', start)
      .lt('created_at', end),
    supabase
      .from('usuarios_negocio')
      .select('local_id')
      .eq('negocio_id', negocio.id)
      .not('local_id', 'is', null),
  ])

  const plazas = locales ?? []
  const datos = new Map(
    ((comparativo ?? []) as VentasPlazaRow[]).map((r) => [r.local_id, r]),
  )
  const equipoPorPlaza = new Map<string, number>()
  for (const a of asignaciones ?? []) {
    equipoPorPlaza.set(a.local_id!, (equipoPorPlaza.get(a.local_id!) ?? 0) + 1)
  }

  const poolTotal = (ventasPool ?? []).reduce((s, v) => s + v.total, 0)
  const poolNum = (ventasPool ?? []).length

  const totalVentas =
    plazas.reduce((s, pl) => s + (datos.get(pl.id)?.total_ventas ?? 0), 0) + poolTotal
  const maxVentas = Math.max(
    ...plazas.map((pl) => datos.get(pl.id)?.total_ventas ?? 0),
    poolTotal,
    1,
  )

  const periodoLabel = PERIODOS.find((x) => x.value === periodo)?.label ?? 'Hoy'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">Plazas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Control por ubicación — {periodoLabel.toLowerCase()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/plazas/stock"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Package className="h-3.5 w-3.5" />
            Inventario
          </Link>
          <Link
            href="/configuracion/plazas"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Gestionar
          </Link>
        </div>
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

      {/* Tarjetas de plazas (la principal primero) */}
      <div className="space-y-3">
        {plazas.map((pl, idx) => {
          const d = datos.get(pl.id)
          const ventas = d?.total_ventas ?? 0
          const gastos = d?.total_gastos ?? 0
          const utilidad = ventas - gastos
          const pct = Math.round((ventas / maxVentas) * 100)
          const equipo = equipoPorPlaza.get(pl.id) ?? 0
          return (
            <Link
              key={pl.id}
              href={`/plazas/${pl.id}?p=${periodo}`}
              className="card-soft block space-y-3 p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{ backgroundColor: pl.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {pl.nombre}
                    {idx === 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        Principal
                      </span>
                    )}
                  </p>
                  {pl.direccion && (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" /> {pl.direccion}
                    </p>
                  )}
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                  Ver plaza <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>

              {/* Barra proporcional de ventas */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Ventas</span>
                  <span className="font-semibold text-foreground tabular-nums">{formatMXN(ventas)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: pl.color }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <MiniDato Icon={ShoppingCart} label="Ventas" value={String(d?.num_ventas ?? 0)} />
                <MiniDato Icon={Users} label="Equipo" value={String(equipo)} />
                <MiniDato Icon={Receipt} label="Gastos" value={formatMXN(gastos)} />
                <MiniDato
                  Icon={TrendingUp}
                  label="Utilidad"
                  value={formatMXN(utilidad)}
                  color={utilidad >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}
                />
              </div>
            </Link>
          )
        })}

        {/* Pool general: bodega / ventas sin plaza */}
        <div className="rounded-xl border border-dashed border-border/80 p-4 space-y-2">
          <div className="flex items-center gap-2.5">
            <Warehouse className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-semibold">General (sin plaza)</p>
              <p className="text-xs text-muted-foreground">
                Mercancía en bodega/casa y ventas hechas sin plaza asignada
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums">{formatMXN(poolTotal)}</p>
              <p className="text-[10px] text-muted-foreground">{poolNum} venta{poolNum !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Total consolidado */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total consolidado — {periodoLabel.toLowerCase()}
            </p>
            <p className="text-lg font-black tabular-nums">{formatMXN(totalVentas)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniDato({
  Icon, label, value, color,
}: {
  Icon: React.FC<{ className?: string }>
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="rounded-lg bg-background/60 px-2 py-1.5">
      <p className="mb-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className={cn('truncate text-sm font-bold tabular-nums', color)}>{value}</p>
    </div>
  )
}
