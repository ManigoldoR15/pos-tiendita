import { requireSuperAdmin } from '@/lib/superadmin'
import { formatMXN } from '@/lib/dinero'
import { tipoLabel, TIPOS_NEGOCIO } from '@/lib/tipos-negocio'
import Link from 'next/link'
import {
  Users, ShieldCheck, Shield, UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EstadoCuentaBadge, ActividadBadge, ESTADOS_CUENTA, LeyendaEstados } from '../../estados'

// Lista ÚNICA de negocios/clientes (Fase 1): fusiona las antiguas
// /superadmin/negocios, /superadmin/clientes y el dashboard de /admin-sistema.
// Operación (ventas, actividad, salud) + cuenta (plan, suscripción, estado).

type NegocioRow = {
  id: string
  nombre: string
  email_dueno: string | null
  nombre_dueno: string | null
  telefono_dueno: string | null
  ubicacion: string | null
  plan: string | null
  suscripcion_inicio: string | null
  suscripcion_fin: string | null
  estado_suscripcion: string
  suspendido: boolean
  negocio_created_at: string
  ventas_mes: number
  num_ventas_mes: number
  ultima_venta: string | null
  activo_hoy: boolean
  num_usuarios: number
  tipo_negocio: string
  ciudad: string | null
  estado_mx: string | null
  inscrito_sat: boolean
  num_productos: number
  dias_sin_venta: number
  last_sign_in: string | null
  max_plazas: number
  num_plazas: number
  es_demo: boolean
}

function calcHealthScore(c: NegocioRow): number {
  let s = 0
  if (c.dias_sin_venta <= 7)       s += 40
  else if (c.dias_sin_venta <= 30) s += 20
  if (c.num_productos >= 20)       s += 20
  else if (c.num_productos >= 5)   s += 10
  if (c.num_usuarios > 1)          s += 20
  if (c.ciudad)                    s += 10
  if (c.ventas_mes > 0)            s += 10
  return Math.min(s, 100)
}

function healthBadge(score: number) {
  if (score >= 80) return { emoji: '🟢', label: 'Thriving',  bg: 'bg-emerald-900/40 text-emerald-400' }
  if (score >= 60) return { emoji: '🟡', label: 'Sano',      bg: 'bg-yellow-900/40 text-yellow-400' }
  if (score >= 40) return { emoji: '🟠', label: 'En riesgo', bg: 'bg-orange-900/40 text-orange-400' }
  return             { emoji: '🔴', label: 'Crítico',   bg: 'bg-red-900/40 text-red-400' }
}

function fmtFechaCorta(iso: string) {
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default async function NegociosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; cuenta?: string; actividad?: string; sat?: string; q?: string; demo?: string }>
}) {
  const { supabase } = await requireSuperAdmin()
  const sp = await searchParams
  const { data } = await supabase.rpc('sa_lista_negocios')
  const todos = (data as NegocioRow[] | null) ?? []
  let lista = [...todos]

  // Filtros
  if (sp.q) {
    const q = sp.q.toLowerCase()
    lista = lista.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.email_dueno?.toLowerCase().includes(q) ||
        c.nombre_dueno?.toLowerCase().includes(q) ||
        c.ciudad?.toLowerCase().includes(q),
    )
  }
  if (sp.tipo && sp.tipo !== 'todos') lista = lista.filter((c) => c.tipo_negocio === sp.tipo)
  if (sp.cuenta) lista = lista.filter((c) => c.estado_suscripcion === sp.cuenta)
  if (sp.actividad === 'hoy') lista = lista.filter((c) => !c.suspendido && c.activo_hoy)
  if (sp.actividad === 'inactivo') lista = lista.filter((c) => !c.suspendido && !c.activo_hoy)
  if (sp.sat === 'sat') lista = lista.filter((c) => c.inscrito_sat)
  if (sp.sat === 'informal') lista = lista.filter((c) => !c.inscrito_sat)
  if (sp.demo === 'reales') lista = lista.filter((c) => !c.es_demo)
  if (sp.demo === 'demo') lista = lista.filter((c) => c.es_demo)

  // KPIs: solo negocios REALES (los demo se ven en la lista pero no cuentan)
  const reales = todos.filter((c) => !c.es_demo)
  const numDemos = todos.length - reales.length
  const total = reales.length
  const activosHoy = reales.filter((c) => c.activo_hoy && !c.suspendido).length
  const enRiesgo = reales.filter((c) => !c.suspendido && c.dias_sin_venta > 30 && c.dias_sin_venta < 9999).length
  const satPct = total > 0 ? Math.round((reales.filter((c) => c.inscrito_sat).length / total) * 100) : 0
  const cuentaActiva = reales.filter((c) => c.estado_suscripcion === 'activo').length
  const enPrueba = reales.filter((c) => c.estado_suscripcion === 'prueba').length
  const vencidos = reales.filter((c) => c.estado_suscripcion === 'vencido').length
  const suspendidos = reales.filter((c) => c.estado_suscripcion === 'suspendido').length
  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const nuevosMes = reales.filter((c) => new Date(c.negocio_created_at) >= inicioMes).length

  const hayFiltros = sp.q || sp.tipo || sp.cuenta || sp.actividad || sp.sat || sp.demo

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Negocios</h1>
          <p className="mt-1 text-sm text-slate-400">
            {total} reales · {activosHoy} activos hoy · {enRiesgo} en riesgo · {satPct}% en SAT
            {numDemos > 0 && <span className="text-slate-500"> · {numDemos} demo (fuera de KPIs)</span>}
          </p>
        </div>
        <Link
          href="/superadmin/negocios/alta"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Dar de alta cliente
        </Link>
      </div>

      {/* KPIs: cuenta + operación */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total" value={total} sub={`${nuevosMes} nuevos este mes`} color="text-white" />
        <Kpi label="Cuenta activa" value={cuentaActiva} sub={ESTADOS_CUENTA.activo.descr} color="text-emerald-400" />
        <Kpi label="En prueba" value={enPrueba} sub={ESTADOS_CUENTA.prueba.descr} color="text-blue-400" />
        <Kpi label="Vencidos" value={vencidos} sub={ESTADOS_CUENTA.vencido.descr} color="text-amber-400" />
        <Kpi label="Suspendidos" value={suspendidos} sub="acceso bloqueado" color="text-red-400" />
        <Kpi label="Activos hoy" value={activosHoy} sub="vendieron hoy" color="text-emerald-400" />
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3 items-center">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Buscar negocio, dueño, ciudad…"
          className="flex-1 min-w-48 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <select
          name="tipo"
          defaultValue={sp.tipo ?? 'todos'}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none"
        >
          <option value="todos">Todos los tipos</option>
          {Object.entries(TIPOS_NEGOCIO).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>
        <select
          name="cuenta"
          defaultValue={sp.cuenta ?? ''}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none"
        >
          <option value="">Cuenta: todas</option>
          <option value="activo">Activas</option>
          <option value="prueba">En prueba</option>
          <option value="vencido">Vencidas</option>
          <option value="suspendido">Suspendidas</option>
        </select>
        <select
          name="actividad"
          defaultValue={sp.actividad ?? ''}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none"
        >
          <option value="">Actividad: toda</option>
          <option value="hoy">Vendieron hoy</option>
          <option value="inactivo">Sin ventas hoy</option>
        </select>
        <select
          name="sat"
          defaultValue={sp.sat ?? ''}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none"
        >
          <option value="">SAT: todos</option>
          <option value="sat">En el SAT</option>
          <option value="informal">Informales</option>
        </select>
        <select
          name="demo"
          defaultValue={sp.demo ?? ''}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none"
        >
          <option value="">Reales y demo</option>
          <option value="reales">Solo reales</option>
          <option value="demo">Solo demo</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition-colors"
        >
          Filtrar
        </button>
        {hayFiltros && (
          <Link
            href="/superadmin/negocios"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Limpiar filtros
          </Link>
        )}
      </form>

      {/* Tabla */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{lista.length} resultado{lista.length !== 1 ? 's' : ''}</p>
          <LeyendaEstados />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Negocio</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Dueño / Contacto</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cuenta</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Equipo</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Catálogo</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ventas mes</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actividad</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">SAT</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Health</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {lista.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors group">
                  {/* Negocio */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0',
                        c.suspendido ? 'bg-red-900/40 text-red-400' : 'bg-violet-900/40 text-violet-300',
                      )}>
                        {c.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-white text-sm truncate max-w-[180px]">{c.nombre}</p>
                          {c.es_demo && (
                            <span
                              title="Negocio de demostración: funcional, pero no cuenta en KPIs ni cobranza"
                              className="shrink-0 rounded-full bg-slate-700/60 border border-slate-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400"
                            >
                              Demo
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {tipoLabel(c.tipo_negocio)}
                          {c.ciudad ? ` · ${c.ciudad}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Dueño / contacto */}
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <p className="text-slate-300 text-sm truncate max-w-[160px]">{c.nombre_dueno ?? '—'}</p>
                    <p className="text-[11px] text-slate-500 truncate max-w-[160px]">{c.email_dueno ?? c.telefono_dueno ?? '—'}</p>
                  </td>

                  {/* Cuenta */}
                  <td className="px-4 py-3.5 text-center">
                    <EstadoCuentaBadge estado={c.estado_suscripcion} />
                    <p className="mt-1 text-[10px] text-slate-500">
                      {c.plan === 'compra' ? 'Compra única' : c.plan === 'prueba' ? 'Prueba' : c.plan === 'mensual' ? 'Mensual' : c.plan === 'anual' ? 'Anual' : '—'}
                      {c.suscripcion_fin && ` · vence ${fmtFechaCorta(c.suscripcion_fin)}`}
                    </p>
                  </td>

                  {/* Equipo */}
                  <td className="px-4 py-3.5 text-center hidden md:table-cell">
                    <span className="inline-flex items-center gap-1 text-sm text-slate-300">
                      <Users className="h-3.5 w-3.5 text-slate-500" />
                      {c.num_usuarios}
                    </span>
                    {c.max_plazas > 1 && (
                      <p className="text-[10px] text-slate-500">{c.num_plazas}/{c.max_plazas} plazas</p>
                    )}
                  </td>

                  {/* Catálogo */}
                  <td className="px-4 py-3.5 text-center hidden md:table-cell">
                    <span className="text-sm text-slate-300">{c.num_productos} prod.</span>
                  </td>

                  {/* Ventas mes */}
                  <td className="px-4 py-3.5 text-right">
                    <p className="font-bold text-slate-200 tabular-nums text-sm">{formatMXN(c.ventas_mes)}</p>
                    <p className="text-[10px] text-slate-500">{c.num_ventas_mes} tx</p>
                  </td>

                  {/* Actividad (última venta — la suspensión vive en Cuenta) */}
                  <td className="px-4 py-3.5 text-center">
                    <ActividadBadge activoHoy={c.activo_hoy} diasSinVenta={c.dias_sin_venta} />
                  </td>

                  {/* SAT */}
                  <td className="px-4 py-3.5 text-center hidden lg:table-cell">
                    {c.inscrito_sat ? (
                      <span title="En el SAT">
                        <ShieldCheck className="h-4 w-4 text-emerald-400 inline" />
                      </span>
                    ) : (
                      <span title="Informal">
                        <Shield className="h-4 w-4 text-slate-600 inline" />
                      </span>
                    )}
                  </td>

                  {/* Health Score */}
                  <td className="px-4 py-3.5 text-center">
                    {(() => {
                      const score = calcHealthScore(c)
                      const { emoji, label, bg } = healthBadge(score)
                      return (
                        <span
                          title={`${label} (${score}/100)`}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${bg}`}
                        >
                          {emoji} {score}
                        </span>
                      )
                    })()}
                  </td>

                  {/* Acción */}
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/superadmin/negocios/${c.id}`}
                      className="text-xs text-slate-500 group-hover:text-violet-400 transition-colors font-medium"
                    >
                      Gestionar →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {lista.length === 0 && (
            <div className="py-16 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-700 mb-3" />
              <p className="text-slate-500">Sin resultados para estos filtros</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={cn('text-2xl font-black mt-1 tabular-nums', color)}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}
