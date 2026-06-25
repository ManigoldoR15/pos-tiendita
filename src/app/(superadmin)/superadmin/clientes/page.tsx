import { requireSuperAdmin } from '@/lib/superadmin'
import { formatMXN } from '@/lib/dinero'
import { tipoLabel, TIPOS_NEGOCIO } from '@/lib/tipos-negocio'
import Link from 'next/link'
import {
  Users, CheckCircle, XCircle, Clock, AlertCircle, ShieldCheck, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ClienteRow = {
  id: string
  nombre: string
  email_dueno: string | null
  nombre_dueno: string | null
  plan: string | null
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
}

function calcHealthScore(c: ClienteRow): number {
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

function diasLabel(dias: number) {
  if (dias === 9999) return 'Sin ventas'
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias <= 7) return `${dias}d`
  if (dias <= 30) return `${dias}d`
  return `${dias}d`
}

function diasColor(dias: number) {
  if (dias <= 7) return 'text-emerald-400'
  if (dias <= 30) return 'text-yellow-400'
  if (dias <= 90) return 'text-orange-400'
  return 'text-red-400'
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; activo?: string; sat?: string; q?: string }>
}) {
  const { supabase } = await requireSuperAdmin()
  const sp = await searchParams
  const { data } = await supabase.rpc('sa_lista_negocios')
  let clientes = (data as ClienteRow[] | null) ?? []

  // Filtros en servidor
  if (sp.q) {
    const q = sp.q.toLowerCase()
    clientes = clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.email_dueno?.toLowerCase().includes(q) ||
        c.nombre_dueno?.toLowerCase().includes(q) ||
        c.ciudad?.toLowerCase().includes(q),
    )
  }
  if (sp.tipo && sp.tipo !== 'todos') {
    clientes = clientes.filter((c) => c.tipo_negocio === sp.tipo)
  }
  if (sp.activo === 'activo') clientes = clientes.filter((c) => !c.suspendido && c.activo_hoy)
  if (sp.activo === 'inactivo') clientes = clientes.filter((c) => !c.suspendido && !c.activo_hoy)
  if (sp.activo === 'suspendido') clientes = clientes.filter((c) => c.suspendido)
  if (sp.sat === 'sat') clientes = clientes.filter((c) => c.inscrito_sat)
  if (sp.sat === 'informal') clientes = clientes.filter((c) => !c.inscrito_sat)

  const total = (data as ClienteRow[] | null)?.length ?? 0
  const activosHoy = (data as ClienteRow[] | null)?.filter((c) => c.activo_hoy && !c.suspendido).length ?? 0
  const enRiesgo = (data as ClienteRow[] | null)?.filter((c) => !c.suspendido && c.dias_sin_venta > 30 && c.dias_sin_venta < 9999).length ?? 0
  const satPct = total > 0
    ? Math.round(((data as ClienteRow[]).filter((c) => c.inscrito_sat).length / total) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">Clientes</h1>
        <p className="mt-1 text-sm text-slate-400">
          {total} registrados · {activosHoy} activos hoy · {enRiesgo} en riesgo · {satPct}% en SAT
        </p>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total</p>
          <p className="text-2xl font-black text-white mt-1">{total}</p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Activos hoy</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{activosHoy}</p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">En riesgo</p>
          <p className="text-2xl font-black text-orange-400 mt-1">{enRiesgo}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">sin ventas +30d</p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">% SAT</p>
          <p className="text-2xl font-black text-violet-400 mt-1">{satPct}%</p>
          <p className="text-[10px] text-slate-500 mt-0.5">inscritos</p>
        </div>
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
          name="activo"
          defaultValue={sp.activo ?? ''}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activos hoy</option>
          <option value="inactivo">Inactivos</option>
          <option value="suspendido">Suspendidos</option>
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
        <button
          type="submit"
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition-colors"
        >
          Filtrar
        </button>
        {(sp.q || sp.tipo || sp.activo || sp.sat) && (
          <Link
            href="/superadmin/clientes"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Limpiar filtros
          </Link>
        )}
      </form>

      {/* Tabla */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-500">{clientes.length} resultado{clientes.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Negocio</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Dueño / Email</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden xl:table-cell">Ubicación</th>
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
              {clientes.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors group">
                  {/* Nombre */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0',
                        c.suspendido ? 'bg-red-900/40 text-red-400' : 'bg-violet-900/40 text-violet-300',
                      )}>
                        {c.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{c.nombre}</p>
                        <p className="text-[10px] text-slate-500">
                          {c.plan === 'prueba' ? 'Prueba' : c.plan === 'mensual' ? 'Mensual' : c.plan === 'anual' ? 'Anual' : '—'}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Tipo */}
                  <td className="px-4 py-3.5">
                    <span className="text-sm">{tipoLabel(c.tipo_negocio)}</span>
                  </td>

                  {/* Dueño */}
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <p className="text-slate-300 text-sm truncate max-w-[160px]">{c.nombre_dueno ?? '—'}</p>
                    <p className="text-[11px] text-slate-500 truncate max-w-[160px]">{c.email_dueno ?? '—'}</p>
                  </td>

                  {/* Ubicación */}
                  <td className="px-4 py-3.5 hidden xl:table-cell">
                    <p className="text-sm text-slate-400 truncate max-w-[140px]">
                      {c.ciudad && c.estado_mx ? `${c.ciudad}, ${c.estado_mx}` : c.estado_mx ?? c.ciudad ?? '—'}
                    </p>
                  </td>

                  {/* Equipo */}
                  <td className="px-4 py-3.5 text-center hidden md:table-cell">
                    <span className="inline-flex items-center gap-1 text-sm text-slate-300">
                      <Users className="h-3.5 w-3.5 text-slate-500" />
                      {c.num_usuarios}
                    </span>
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

                  {/* Actividad */}
                  <td className="px-4 py-3.5 text-center">
                    {c.suspendido ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-900/40 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                        <XCircle className="h-3 w-3" /> Susp.
                      </span>
                    ) : c.activo_hoy ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle className="h-3 w-3" /> Hoy
                      </span>
                    ) : (
                      <span className={cn('text-xs font-semibold tabular-nums', diasColor(c.dias_sin_venta))}>
                        {diasLabel(c.dias_sin_venta)}
                        {c.dias_sin_venta > 30 && c.dias_sin_venta < 9999 && (
                          <AlertCircle className="inline h-3 w-3 ml-0.5 mb-0.5" />
                        )}
                      </span>
                    )}
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
                      href={`/superadmin/clientes/${c.id}`}
                      className="text-xs text-slate-500 group-hover:text-violet-400 transition-colors font-medium"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {clientes.length === 0 && (
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
