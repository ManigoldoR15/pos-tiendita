import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowLeft, ArrowRightLeft, Users, Package, PackagePlus, ShoppingCart, Receipt, Clock, MapPin,
  TrendingUp, ChevronRight, CircleDollarSign,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { requireModulo } from '@/lib/modulos'
import { getRolActual } from '@/lib/rol'
import { formatMXN } from '@/lib/dinero'
import { getRango, type Periodo } from '@/lib/periodo'
import { cn } from '@/lib/utils'

const TZ = 'America/Mexico_City'

const PERIODOS = [
  { label: 'Hoy', value: 'hoy' },
  { label: 'Semana', value: 'semana' },
  { label: 'Mes', value: 'mes' },
] as const

const ROL_LABEL: Record<string, string> = {
  dueno: 'Dueño', empleado: 'Empleado', administrador: 'Admin',
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}
function fechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default async function PlazaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ p?: string }>
}) {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  await requireModulo('multi_plaza')
  const rol = await getRolActual()
  if (rol && rol !== 'dueno') redirect('/')

  const { id } = await params
  const { p = 'hoy' } = await searchParams
  const periodo = p as Periodo
  const { start, end } = getRango(periodo)

  const supabase = await createClient()

  const { data: plaza } = await supabase
    .from('locales')
    .select('id, nombre, direccion, color, activo')
    .eq('id', id)
    .eq('negocio_id', negocio.id)
    .single()
  if (!plaza) notFound()

  const [
    { data: asignados },
    { data: miembros },
    { data: ventas },
    { data: lotes },
    { data: cortes },
  ] = await Promise.all([
    supabase
      .from('usuarios_negocio')
      .select('user_id, rol')
      .eq('negocio_id', negocio.id)
      .eq('local_id', id),
    supabase.rpc('get_miembros_negocio', { p_negocio_id: negocio.id }),
    supabase
      .from('ventas')
      .select('id, total, created_at, vendedor_id')
      .eq('negocio_id', negocio.id)
      .eq('local_id', id)
      .eq('estado', 'completada')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false }),
    supabase
      .from('lotes_producto')
      .select('cantidad_actual, productos(id, nombre, unidad_medida, precio_costo)')
      .eq('negocio_id', negocio.id)
      .eq('local_id', id)
      .eq('activo', true)
      .gt('cantidad_actual', 0),
    supabase
      .from('cortes_caja')
      .select('id, fecha_apertura, fecha_cierre, diferencia, estado, abierto_por')
      .eq('negocio_id', negocio.id)
      .eq('local_id', id)
      .order('fecha_apertura', { ascending: false })
      .limit(5),
  ])

  // Mapa user_id → email (para vendedores y equipo)
  const emailDe = new Map<string, string>(
    ((miembros as { user_id: string; email: string }[] | null) ?? []).map((m) => [m.user_id, m.email]),
  )
  const nombreDe = (uid: string | null) =>
    uid ? (emailDe.get(uid)?.split('@')[0] ?? 'desconocido') : 'sin vendedor'

  // Equipo de la plaza + quién está en turno ahora
  const equipo = (asignados ?? []) as { user_id: string; rol: string }[]
  const { data: turnosAbiertos } = await supabase
    .from('registros_turno')
    .select('user_id, nombre, entrada_at')
    .eq('negocio_id', negocio.id)
    .is('salida_at', null)
  const enTurno = new Map(
    (turnosAbiertos ?? []).map((t) => [t.user_id, t.entrada_at as string]),
  )

  // KPIs de ventas del período + desglose por vendedor
  const listaVentas = (ventas ?? []) as { id: string; total: number; created_at: string; vendedor_id: string | null }[]
  const totalVentas = listaVentas.reduce((s, v) => s + v.total, 0)
  const ticketProm = listaVentas.length > 0 ? Math.round(totalVentas / listaVentas.length) : 0

  const porVendedor = new Map<string, { total: number; num: number }>()
  for (const v of listaVentas) {
    const k = v.vendedor_id ?? '_sin'
    const acc = porVendedor.get(k) ?? { total: 0, num: 0 }
    acc.total += v.total
    acc.num += 1
    porVendedor.set(k, acc)
  }
  const vendedores = [...porVendedor.entries()].sort((a, b) => b[1].total - a[1].total)

  // Stock de la plaza agregado por producto
  type LoteRow = { cantidad_actual: number; productos: { id: string; nombre: string; unidad_medida: string; precio_costo: number | null } | null }
  const stockPorProducto = new Map<string, { nombre: string; unidad: string; cantidad: number; valor: number }>()
  for (const l of (lotes ?? []) as unknown as LoteRow[]) {
    if (!l.productos) continue
    const acc = stockPorProducto.get(l.productos.id) ?? {
      nombre: l.productos.nombre, unidad: l.productos.unidad_medida, cantidad: 0, valor: 0,
    }
    acc.cantidad += Number(l.cantidad_actual)
    acc.valor += Math.round(Number(l.cantidad_actual) * (l.productos.precio_costo ?? 0))
    stockPorProducto.set(l.productos.id, acc)
  }
  const stock = [...stockPorProducto.values()].sort((a, b) => b.valor - a.valor)
  const valorInventario = stock.reduce((s, x) => s + x.valor, 0)

  const periodoLabel = PERIODOS.find((x) => x.value === periodo)?.label ?? 'Hoy'

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/plazas"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-card text-muted-foreground transition hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div
          className="h-4 w-4 shrink-0 rounded-full"
          style={{ backgroundColor: plaza.color }}
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black tracking-tight">{plaza.nombre}</h1>
          <p className="flex items-center gap-1 text-sm text-muted-foreground truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {plaza.direccion ?? 'Sin dirección registrada'}
            {!plaza.activo && ' · inactiva'}
          </p>
        </div>
      </div>

      {/* Filtro de período */}
      <div className="flex gap-1.5">
        {PERIODOS.map(({ label, value }) => (
          <Link
            key={value}
            href={`/plazas/${plaza.id}?p=${value}`}
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

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi Icon={CircleDollarSign} label={`Ventas ${periodoLabel.toLowerCase()}`} value={formatMXN(totalVentas)} destacado />
        <Kpi Icon={ShoppingCart} label="Transacciones" value={String(listaVentas.length)} />
        <Kpi Icon={TrendingUp} label="Ticket promedio" value={formatMXN(ticketProm)} />
        <Kpi Icon={Package} label="Valor inventario" value={formatMXN(valorInventario)} sub="a costo" />
      </div>

      {/* Equipo de la plaza */}
      <div className="card-soft overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold">Equipo de esta plaza</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {equipo.length} asignado{equipo.length !== 1 ? 's' : ''}
          </span>
        </div>
        {equipo.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Nadie asignado todavía. Asigna empleados a esta plaza en{' '}
            <Link href="/configuracion" className="font-medium text-primary hover:underline">
              Configuración → Empleados
            </Link>{' '}
            para que sus ventas y turnos queden ligados aquí.
          </p>
        ) : (
          <div className="divide-y">
            {equipo.map((m) => {
              const entrada = enTurno.get(m.user_id)
              return (
                <div key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {(emailDe.get(m.user_id) ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{nombreDe(m.user_id)}</p>
                    <p className="text-xs text-muted-foreground">{ROL_LABEL[m.rol] ?? m.rol}</p>
                  </div>
                  {entrada ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      En turno desde {hora(entrada)}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">Fuera de turno</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Ventas por vendedor */}
      <div className="card-soft overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <ShoppingCart className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold">Ventas por vendedor — {periodoLabel.toLowerCase()}</span>
        </div>
        {vendedores.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Sin ventas en este período.</p>
        ) : (
          <div className="divide-y">
            {vendedores.map(([uid, v]) => (
              <div key={uid} className="flex items-center gap-3 px-5 py-3">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {uid === '_sin' ? 'Sin vendedor registrado' : nombreDe(uid)}
                </p>
                <span className="text-xs text-muted-foreground">{v.num} venta{v.num !== 1 ? 's' : ''}</span>
                <span className="text-sm font-bold tabular-nums">{formatMXN(v.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stock de la plaza */}
      <div className="card-soft overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold">Stock en esta plaza</span>
        </div>

        {/* Las dos formas de meter mercancía aquí: dar de alta algo que no está
            en el catálogo, o registrar la llegada de algo que ya existe. */}
        <div className="flex gap-2 border-b px-5 py-3">
          <Link
            href={`/productos/nuevo?plaza=${plaza.id}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90"
          >
            <PackagePlus className="h-3.5 w-3.5" />
            Producto nuevo
          </Link>
          <Link
            href={`/compras/nueva?plaza=${plaza.id}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-bold transition hover:bg-accent"
          >
            <Package className="h-3.5 w-3.5" />
            Agregar stock
          </Link>
        </div>
        {stock.length === 0 ? (
          <div className="space-y-3 px-5 py-6">
            <p className="text-sm text-muted-foreground">
              Sin stock asignado. Mientras esta plaza esté vacía, un empleado asignado
              aquí verá todo agotado y no podrá cobrar.
            </p>
            <Link
              href={`/plazas/stock?hacia=${plaza.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/5"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Traer mercancía del general
            </Link>
            <p className="text-xs text-muted-foreground">
              O usa <strong>Producto nuevo</strong> para dar de alta algo que no está en tu
              catálogo, y <strong>Agregar stock</strong> para registrar la llegada de algo que ya existe.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {stock.slice(0, 8).map((s) => (
              <div key={s.nombre} className="flex items-center gap-3 px-5 py-2.5">
                <p className="min-w-0 flex-1 truncate text-sm">{s.nombre}</p>
                <span className="text-sm font-semibold tabular-nums">
                  {s.cantidad.toLocaleString('es-MX', { maximumFractionDigits: 3 })} {s.unidad === 'pieza' ? 'pza' : s.unidad}
                </span>
                <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">{formatMXN(s.valor)}</span>
              </div>
            ))}
            {stock.length > 8 && (
              <p className="px-5 py-2 text-xs text-muted-foreground">y {stock.length - 8} producto(s) más…</p>
            )}
          </div>
        )}
        <Link
          href="/plazas/stock"
          className="flex items-center gap-1 border-t px-5 py-3 text-xs font-medium text-primary hover:bg-accent"
        >
          Ver inventario / transferir entre plazas <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Ventas recientes */}
      <div className="card-soft overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold">Ventas recientes de la plaza</span>
        </div>
        {listaVentas.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Sin ventas en este período.</p>
        ) : (
          <div className="divide-y">
            {listaVentas.slice(0, 10).map((v) => (
              <Link
                key={v.id}
                href={`/ventas/${v.id}`}
                className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-accent/40"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{nombreDe(v.vendedor_id)}</span>
                <span className="text-xs text-muted-foreground">{fechaHora(v.created_at)}</span>
                <span className="text-sm font-bold tabular-nums">{formatMXN(v.total)}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Cortes de caja recientes */}
      <div className="card-soft overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold">Cortes de caja de esta plaza</span>
          <Link href="/turnos" className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Ver turnos <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {(cortes ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Sin cortes registrados en esta plaza todavía.
          </p>
        ) : (
          <div className="divide-y">
            {(cortes ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {nombreDe(c.abierto_por)} · {fechaHora(c.fecha_apertura)}
                </span>
                {c.estado === 'abierto' ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    ABIERTO
                  </span>
                ) : (
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      (c.diferencia ?? 0) === 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-destructive',
                    )}
                  >
                    {(c.diferencia ?? 0) === 0 ? 'Cuadró' : `Dif. ${formatMXN(c.diferencia ?? 0)}`}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({
  Icon, label, value, sub, destacado,
}: {
  Icon: React.FC<{ className?: string }>
  label: string
  value: string
  sub?: string
  destacado?: boolean
}) {
  return (
    <div className={cn('rounded-xl border p-3', destacado ? 'bg-primary/[0.06] border-primary/20' : 'bg-card')}>
      <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="truncate text-lg font-black tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
