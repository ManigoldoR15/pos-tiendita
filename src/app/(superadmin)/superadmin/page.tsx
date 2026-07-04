import { requireSuperAdmin } from '@/lib/superadmin'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHoraCorta, hoyMX, addDaysMX, fmtFechaCorta } from '@/lib/fecha'
import Link from 'next/link'
import { Store, TrendingUp, ShoppingCart, Users, AlertTriangle, Activity, Clock } from 'lucide-react'
import { EstadoCuentaBadge } from '../estados'

type Stats = {
  total_negocios: number
  ventas_hoy: number
  ventas_mes: number
  num_ventas_hoy: number
  negocios_activos_hoy: number
  total_registros_usuarios_negocio: number
  negocios_nuevos_mes: number
  negocios_suspendidos: number
  monto_historico: number
  total_ventas_historico: number
  top_productos_30d: { nombre: string; unidades: number; monto: number }[] | null
  metodos_pago_dist: { nombre: string; num: number; pct: number }[] | null
}

type NegocioRow = {
  id: string
  nombre: string
  email_dueno: string | null
  nombre_dueno: string | null
  plan: string | null
  suspendido: boolean
  ventas_mes: number
  num_ventas_mes: number
  ultima_venta: string | null
  activo_hoy: boolean
  estado_suscripcion: string
  suscripcion_fin: string | null
  es_demo: boolean
  num_usuarios: number
  negocio_created_at: string
}

export default async function SuperAdminPage() {
  const { supabase } = await requireSuperAdmin()

  const inicioMes = hoyMX().slice(0, 7) + '-01'
  const [{ data: statsRaw }, { data: negocios }, { data: pagosMes }] = await Promise.all([
    supabase.rpc('sa_stats_globales'),
    supabase.rpc('sa_lista_negocios'),
    supabase
      .from('pagos_suscripcion')
      .select('monto, negocios!inner(es_demo)')
      .eq('negocios.es_demo', false)
      .gte('fecha_pago', inicioMes),
  ])

  const stats = statsRaw as Stats | null
  // Solo negocios reales: los demo no cuentan para decisiones ni cobranza
  const lista = ((negocios as NegocioRow[] | null) ?? []).filter((n) => !n.es_demo)
  const suspendidos = lista.filter((n) => n.suspendido)
  const recientes = lista.slice(0, 5)

  // Cobranza: ingresos del mes + suscripciones vencidas / por vencer (≤7 días)
  const ingresosMes = (pagosMes ?? []).reduce((s, p) => s + (p.monto as number), 0)
  const numPagosMes = (pagosMes ?? []).length
  const limite7d = addDaysMX(hoyMX(), 7)
  const vencidas = lista.filter((n) => n.estado_suscripcion === 'vencido')
  const porVencer = lista.filter(
    (n) => n.estado_suscripcion === 'activo' && n.suscripcion_fin && n.suscripcion_fin <= limite7d,
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight md:text-3xl">Dashboard de plataforma</h1>
        <p className="mt-1 text-sm text-slate-400">
          Vista global de todos los negocios registrados en POS Tiendita
        </p>
      </div>

      {/* Alerta suspendidos */}
      {suspendidos.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">
            <strong>{suspendidos.length}</strong> negocio{suspendidos.length > 1 ? 's' : ''} suspendido{suspendidos.length > 1 ? 's' : ''}: {suspendidos.map((n) => n.nombre).join(', ')}
          </p>
          <Link href="/superadmin/negocios" className="ml-auto text-xs text-red-400 hover:text-red-200 underline whitespace-nowrap">
            Ver →
          </Link>
        </div>
      )}

      {/* Cobranza: ingresos + vencimientos */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Cobranza</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Ingresos este mes</p>
            <p className="text-2xl font-black text-emerald-400 tabular-nums mt-1">{formatMXN(ingresosMes)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{numPagosMes} pago{numPagosMes !== 1 ? 's' : ''} registrado{numPagosMes !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Vencen en ≤ 7 días</p>
            {porVencer.length === 0 ? (
              <p className="text-sm text-slate-500 mt-2">Nada por vencer esta semana.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {porVencer.slice(0, 4).map((n) => (
                  <li key={n.id}>
                    <Link href={`/superadmin/negocios/${n.id}`} className="text-sm text-slate-200 hover:text-amber-300 transition-colors">
                      {n.nombre} <span className="text-xs text-slate-500">· {n.suscripcion_fin && fmtFechaCorta(n.suscripcion_fin + 'T12:00:00')}</span>
                    </Link>
                  </li>
                ))}
                {porVencer.length > 4 && (
                  <li className="text-xs text-slate-500">y {porVencer.length - 4} más…</li>
                )}
              </ul>
            )}
          </div>
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Vencidas (cobrar)</p>
            {vencidas.length === 0 ? (
              <p className="text-sm text-slate-500 mt-2">Sin suscripciones vencidas.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {vencidas.slice(0, 4).map((n) => (
                  <li key={n.id}>
                    <Link href={`/superadmin/negocios/${n.id}`} className="text-sm text-slate-200 hover:text-red-300 transition-colors">
                      {n.nombre} <span className="text-xs text-slate-500">· venció {n.suscripcion_fin && fmtFechaCorta(n.suscripcion_fin + 'T12:00:00')}</span>
                    </Link>
                  </li>
                ))}
                {vencidas.length > 4 && (
                  <li className="text-xs text-slate-500">y {vencidas.length - 4} más…</li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Negocios totales"
          value={String(stats?.total_negocios ?? 0)}
          Icon={Store}
          sub={`${stats?.negocios_nuevos_mes ?? 0} nuevos este mes`}
          color="text-emerald-400"
        />
        <KpiCard
          label="Ventas hoy"
          value={formatMXN(stats?.ventas_hoy ?? 0)}
          Icon={TrendingUp}
          sub={`${stats?.num_ventas_hoy ?? 0} transacciones`}
          color="text-blue-400"
        />
        <KpiCard
          label="Ventas este mes"
          value={formatMXN(stats?.ventas_mes ?? 0)}
          Icon={ShoppingCart}
          sub={`${stats?.negocios_activos_hoy ?? 0} negocios vendieron hoy`}
          color="text-violet-400"
        />
        <KpiCard
          label="Usuarios/negocios"
          value={String(stats?.total_registros_usuarios_negocio ?? 0)}
          Icon={Users}
          sub="registros totales"
          color="text-amber-400"
        />
      </div>

      {/* Monto histórico */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 md:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
          Volumen total procesado (histórico)
        </p>
        <p className="text-3xl font-black text-white tabular-nums tracking-tight md:text-5xl">
          {formatMXN(stats?.monto_historico ?? 0)}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          en {(stats?.total_ventas_historico ?? 0).toLocaleString('es-MX')} ventas completadas
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top productos 30d */}
        {stats?.top_productos_30d && stats.top_productos_30d.length > 0 && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-200">Top productos (últimos 30 días)</p>
              <span className="ml-auto text-xs text-slate-500">Todas las tiendas</span>
            </div>
            <div className="space-y-3">
              {stats.top_productos_30d.slice(0, 8).map((p, i) => {
                const max = stats.top_productos_30d![0]?.unidades ?? 1
                const pct = Math.round((p.unidades / max) * 100)
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-200 truncate max-w-[65%]">{p.nombre}</span>
                      <span className="text-xs text-slate-400 tabular-nums">{p.unidades.toLocaleString('es-MX')} u</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Métodos de pago */}
        {stats?.metodos_pago_dist && stats.metodos_pago_dist.length > 0 && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-5">
              <ShoppingCart className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-200">Distribución de métodos de pago</p>
            </div>
            <div className="space-y-3">
              {stats.metodos_pago_dist.map((m, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-200">{m.nombre}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{m.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Negocios recientes */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-200">Negocios registrados</p>
          </div>
          <Link href="/superadmin/negocios" className="text-xs text-slate-400 hover:text-white transition-colors">
            Ver todos →
          </Link>
        </div>
        <div className="divide-y divide-slate-800">
          {recientes.map((n) => (
            <Link
              key={n.id}
              href={`/superadmin/negocios/${n.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors md:gap-4 md:px-6 md:py-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white truncate">{n.nombre}</p>
                  <EstadoCuentaBadge estado={n.estado_suscripcion} className="shrink-0" />
                  {n.activo_hoy && !n.suspendido && (
                    <span className="shrink-0 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Vendió hoy
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {n.email_dueno ?? 'Sin email'} · {n.num_usuarios} usuario{n.num_usuarios !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-slate-200 tabular-nums">{formatMXN(n.ventas_mes)}</p>
                <p className="text-xs text-slate-500">{n.num_ventas_mes} ventas este mes</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label, value, sub, Icon, color,
}: {
  label: string; value: string; sub: string; Icon: React.FC<{ className?: string }>; color: string
}) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  )
}
