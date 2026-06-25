import { requireSuperAdmin } from '@/lib/superadmin'
import { fmtFechaHoraCorta } from '@/lib/fecha'
import { Activity, Users, Clock, TrendingUp, Wifi, AlertTriangle } from 'lucide-react'
import { SospechaBadge } from './SospechaBadge'

type BitacoraRow = {
  email_usuario: string | null
  negocio_nombre: string | null
  fecha: string
  primera_vista: string
  ultima_vista: string
  num_vistas: number
}

type ActiveRow = { periodo: string; cantidad: number }

type IpRow = {
  user_id: string
  email_usuario: string | null
  negocio_nombre: string | null
  negocio_id: string | null
  num_ips: number
  ips: string[]
  sospecha: boolean
}

export default async function AccesosPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>
}) {
  const { supabase } = await requireSuperAdmin()
  const sp = await searchParams
  const dias = parseInt(sp.dias ?? '7')

  const [{ data: bitacora }, { data: activos }, { data: ipsPorUsuario }] = await Promise.all([
    supabase.rpc('sa_bitacora', { p_dias: dias }),
    supabase.rpc('sa_usuarios_activos'),
    supabase.rpc('sa_ips_por_usuario', { p_dias: dias }),
  ])

  const filas = (bitacora as BitacoraRow[] | null) ?? []
  const activosMap = Object.fromEntries(
    ((activos as ActiveRow[] | null) ?? []).map((r) => [r.periodo, r.cantidad]),
  )
  const ipFilas = (ipsPorUsuario as IpRow[] | null) ?? []

  // Contadores para el resumen de IPs
  const conMultiplesIPs = ipFilas.filter((r) => r.num_ips >= 3).length
  const marcadosSospecha = ipFilas.filter((r) => r.sospecha).length

  // Actividad por día para mini gráfico
  const porFecha: Record<string, number> = {}
  for (const f of filas) {
    porFecha[f.fecha] = (porFecha[f.fecha] ?? 0) + 1
  }
  const fechas = Object.entries(porFecha).sort(([a], [b]) => a.localeCompare(b))
  const maxFecha = Math.max(...fechas.map(([, n]) => n), 1)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-violet-400" />
          <h1 className="text-3xl font-black text-white tracking-tight">Bitácora de accesos</h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Registro de quién entra a la plataforma y cuándo
        </p>
      </div>

      {/* KPIs de usuarios activos */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Activos hoy</p>
          </div>
          <p className="text-3xl font-black text-emerald-400">{activosMap['hoy'] ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">usuarios únicos</p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Últimos 7 días</p>
          </div>
          <p className="text-3xl font-black text-blue-400">{activosMap['7d'] ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">usuarios únicos</p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-3.5 w-3.5 text-violet-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Últimos 30 días</p>
          </div>
          <p className="text-3xl font-black text-violet-400">{activosMap['30d'] ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">usuarios únicos</p>
        </div>
      </div>

      {/* ── Sección de IPs por usuario ──────────────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Wifi className="h-4 w-4 text-amber-400" />
            <div>
              <p className="text-sm font-bold text-white">Detección anti cuenta-compartida</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                IPs distintas por usuario en los últimos {dias} días
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {conMultiplesIPs > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950/60 border border-amber-800/40 px-2.5 py-1 text-[10px] font-bold text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {conMultiplesIPs} con ≥3 IPs
              </span>
            )}
            {marcadosSospecha > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-950/60 border border-red-800/40 px-2.5 py-1 text-[10px] font-bold text-red-400">
                <AlertTriangle className="h-3 w-3" />
                {marcadosSospecha} marcados
              </span>
            )}
          </div>
        </div>

        {ipFilas.length === 0 ? (
          <div className="py-10 text-center">
            <Wifi className="mx-auto h-8 w-8 text-slate-700 mb-2" />
            <p className="text-sm text-slate-500">Sin datos de IP todavía</p>
            <p className="text-xs text-slate-600 mt-1">
              Las IPs se empiezan a registrar con los próximos accesos
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Usuario / Negocio
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    IPs distintas
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                    Direcciones IP
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Sospecha
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ipFilas.map((f) => {
                  const esAlerta = f.num_ips >= 3
                  return (
                    <tr
                      key={f.user_id}
                      className={`transition-colors ${
                        f.sospecha
                          ? 'bg-red-950/10 hover:bg-red-950/20'
                          : esAlerta
                            ? 'bg-amber-950/10 hover:bg-amber-950/20'
                            : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-violet-900/60 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
                            {(f.email_usuario ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-slate-200 truncate max-w-[180px]">
                              {f.email_usuario ?? '—'}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                              {f.negocio_nombre ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-black ${
                            f.sospecha
                              ? 'bg-red-950/60 text-red-400'
                              : esAlerta
                                ? 'bg-amber-950/60 text-amber-400'
                                : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {f.num_ips}
                        </span>
                        {esAlerta && (
                          <p className="text-[9px] text-amber-500 mt-0.5">⚠ posible</p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {f.ips.map((ip) => (
                            <span
                              key={ip}
                              className="inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400"
                            >
                              {ip}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <SospechaBadge
                          negocioId={f.negocio_id}
                          sospecha={f.sospecha}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actividad por día (mini gráfico) */}
      {fechas.length > 0 && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Accesos por día</p>
          <div className="flex items-end gap-1.5 h-16">
            {fechas.map(([fecha, n]) => {
              const h = Math.round((n / maxFecha) * 100)
              return (
                <div key={fecha} className="flex-1 flex flex-col items-center gap-1 group/bar">
                  <span className="text-[9px] text-slate-400 opacity-0 group-hover/bar:opacity-100 transition-opacity">{n}</span>
                  <div
                    className="w-full rounded-t bg-violet-500/70 group-hover/bar:bg-violet-400 transition-colors"
                    style={{ height: `${Math.max(h, 3)}%` }}
                    title={`${fecha}: ${n} usuario${n !== 1 ? 's' : ''}`}
                  />
                  <span className="text-[8px] text-slate-600 whitespace-nowrap">{fecha.slice(5)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtro de días */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-500">Mostrar:</p>
        {[7, 14, 30].map((d) => (
          <a
            key={d}
            href={`/superadmin/accesos?dias=${d}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              dias === d
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Últimos {d} días
          </a>
        ))}
      </div>

      {/* Tabla bitácora completa */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <p className="text-xs text-slate-500">
            {filas.length} registro{filas.length !== 1 ? 's' : ''} en los últimos {dias} días
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Negocio</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Primera entrada</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Última actividad</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Visitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filas.map((f, i) => (
                <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-violet-900/60 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
                        {(f.email_usuario ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm text-slate-200 truncate max-w-[180px]">{f.email_usuario ?? '—'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm text-slate-400 truncate max-w-[160px]">{f.negocio_nombre ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs text-slate-300 tabular-nums">{f.fecha}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {fmtFechaHoraCorta(f.primera_vista)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                      {fmtFechaHoraCorta(f.ultima_vista)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-400">
                      {f.num_vistas}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filas.length === 0 && (
          <div className="py-16 text-center">
            <Activity className="mx-auto h-10 w-10 text-slate-700 mb-3" />
            <p className="text-slate-500">Sin registros todavía</p>
            <p className="text-xs text-slate-600 mt-1">Los accesos se empiezan a registrar desde hoy</p>
          </div>
        )}
      </div>
    </div>
  )
}
