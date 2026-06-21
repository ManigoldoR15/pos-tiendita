import { requireSuperAdmin } from '@/lib/superadmin'
import { formatMXN } from '@/lib/dinero'
import { BarChart3, Clock, Calendar, CreditCard, Package } from 'lucide-react'

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
  ventas_por_hora: { hora: number; num: number }[]
  ventas_por_dia: { dia: number; nombre: string; num: number }[] | null
}

export default async function EstadisticasPage() {
  const { supabase } = await requireSuperAdmin()
  const { data } = await supabase.rpc('sa_stats_globales')
  const s = (data as Stats | null)

  const horaMax = Math.max(...(s?.ventas_por_hora?.map((h) => h.num) ?? [1]), 1)
  const diaMax = Math.max(...(s?.ventas_por_dia?.map((d) => d.num) ?? [1]), 1)
  const prodMax = s?.top_productos_30d?.[0]?.unidades ?? 1

  const horasPico = (s?.ventas_por_hora ?? [])
    .filter((h) => h.num > 0)
    .sort((a, b) => b.num - a.num)
    .slice(0, 3)
    .map((h) => `${h.hora}:00`)
    .join(', ')

  const efectivoPct = s?.metodos_pago_dist?.find((m) =>
    m.nombre.toLowerCase().includes('efectivo'),
  )?.pct ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">Estadísticas del mercado</h1>
        <p className="mt-1 text-sm text-slate-400">
          Análisis agregado de todos los negocios — datos del mercado informal mexicano
        </p>
      </div>

      {/* Insights del mercado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InsightCard
          label="Efectivo vs digital"
          value={`${efectivoPct}%`}
          sub="de las ventas son en efectivo"
          Icon={CreditCard}
          color="text-amber-400"
        />
        <InsightCard
          label="Horas pico"
          value={horasPico || '—'}
          sub="mayor volumen de ventas"
          Icon={Clock}
          color="text-blue-400"
        />
        <InsightCard
          label="Ticket promedio global"
          value={formatMXN(s ? Math.round(s.monto_historico / Math.max(s.total_ventas_historico, 1)) : 0)}
          sub="por transacción, todas las tiendas"
          Icon={BarChart3}
          color="text-emerald-400"
        />
      </div>

      {/* Ventas por hora */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-semibold text-slate-200">Distribución de ventas por hora del día</p>
        </div>
        <p className="text-xs text-slate-500 mb-6">Últimos 30 días · hora México City</p>
        <div className="flex items-end gap-1 h-36">
          {(s?.ventas_por_hora ?? []).map((h) => {
            const pct = Math.round((h.num / horaMax) * 100)
            const isTop = h.num === horaMax && h.num > 0
            return (
              <div key={h.hora} className="flex-1 flex flex-col items-center gap-1" title={`${h.hora}:00 — ${h.num} ventas`}>
                <div
                  className={`w-full rounded-sm transition-all ${isTop ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  style={{ height: `${Math.max(pct, h.num > 0 ? 4 : 0)}%` }}
                />
                <span className="text-[8px] text-slate-600 tabular-nums">{h.hora}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 inline-block" /> Hora pico</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-700 inline-block" /> Otras horas</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas por día de semana */}
        {s?.ventas_por_dia && s.ventas_por_dia.length > 0 && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-200">Ventas por día de la semana</p>
            </div>
            <p className="text-xs text-slate-500 mb-5">Últimos 90 días</p>
            <div className="space-y-3">
              {s.ventas_por_dia.map((d) => {
                const pct = Math.round((d.num / diaMax) * 100)
                return (
                  <div key={d.dia} className="flex items-center gap-3">
                    <span className="w-8 text-xs font-semibold text-slate-400 shrink-0">{d.nombre}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-xs text-slate-400 text-right tabular-nums">{d.num.toLocaleString('es-MX')}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Métodos de pago */}
        {s?.metodos_pago_dist && s.metodos_pago_dist.length > 0 && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-200">Métodos de pago en el mercado informal</p>
            </div>
            <p className="text-xs text-slate-500 mb-5">Histórico todas las tiendas</p>
            <div className="space-y-4">
              {s.metodos_pago_dist.map((m, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-200">{m.nombre}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-200 tabular-nums">{m.pct}%</span>
                      <span className="text-xs text-slate-500 ml-2">{m.num.toLocaleString('es-MX')} tx</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${m.pct}%`,
                        background: i === 0 ? '#22c55e' : i === 1 ? '#3b82f6' : i === 2 ? '#a855f7' : '#f59e0b',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top productos cross-tenant */}
      {s?.top_productos_30d && s.top_productos_30d.length > 0 && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-200">Productos más vendidos en todo el ecosistema</p>
          </div>
          <p className="text-xs text-slate-500 mb-6">Últimos 30 días · suma de todas las tiendas</p>
          <div className="space-y-3">
            {s.top_productos_30d.map((p, i) => {
              const pct = Math.round((p.unidades / prodMax) * 100)
              return (
                <div key={i} className="flex items-center gap-4">
                  <span className="w-5 text-xs font-bold text-slate-600 text-center shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-200 truncate">{p.nombre}</span>
                      <div className="text-right text-xs text-slate-400 ml-3 shrink-0">
                        <span className="font-semibold text-slate-200">{p.unidades.toLocaleString('es-MX')} u</span>
                        <span className="ml-2">{formatMXN(p.monto)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: i === 0 ? '#f59e0b' : '#475569',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Métricas de salud de la plataforma */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-5">Salud de la plataforma</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Negocios totales" value={String(s?.total_negocios ?? 0)} />
          <Metric label="Nuevos este mes" value={String(s?.negocios_nuevos_mes ?? 0)} highlight />
          <Metric label="Activos hoy" value={String(s?.negocios_activos_hoy ?? 0)} />
          <Metric label="Suspendidos" value={String(s?.negocios_suspendidos ?? 0)} danger={Number(s?.negocios_suspendidos) > 0} />
        </div>
      </div>
    </div>
  )
}

function InsightCard({ label, value, sub, Icon, color }: {
  label: string; value: string; sub: string; Icon: React.FC<{ className?: string }>; color: string
}) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  )
}

function Metric({ label, value, highlight, danger }: {
  label: string; value: string; highlight?: boolean; danger?: boolean
}) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-black tabular-nums ${danger ? 'text-red-400' : highlight ? 'text-emerald-400' : 'text-slate-200'}`}>
        {value}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}
