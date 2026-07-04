import { requireSuperAdmin } from '@/lib/superadmin'
import { fmtFechaHoraCorta } from '@/lib/fecha'
import { geolocalizarIps, geoTexto } from '@/lib/geoip'
import { geocodificarNegociosPendientes } from '@/lib/geocode'
import { Activity, Users, Clock, TrendingUp, Wifi, AlertTriangle, MapPin, Map as MapIcon, Store } from 'lucide-react'
import { SospechaBadge } from './SospechaBadge'
import MapaAccesos, { type NegocioMapa, type UsuarioMapa } from './mapa-accesos'

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

type ActividadRow = {
  user_id: string
  email_usuario: string | null
  rol: string | null
  negocio_id: string | null
  negocio_nombre: string | null
  negocio_lat: number | null
  negocio_lon: number | null
  primera_vista: string
  ultima_vista: string
  num_vistas: number
  ip_addresses: string[]
}

const ROL_LABEL: Record<string, string> = {
  dueno: 'Dueño', empleado: 'Empleado', administrador: 'Admin',
}

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function haceTexto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h ${min % 60} min`
  return `hace ${Math.floor(h / 24)} día${h >= 48 ? 's' : ''}`
}

function duracionTexto(inicioIso: string, finIso: string): string {
  const min = Math.max(0, Math.round((new Date(finIso).getTime() - new Date(inicioIso).getTime()) / 60000))
  if (min < 1) return 'recién entró'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

export default async function AccesosPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>
}) {
  const { supabase } = await requireSuperAdmin()
  const sp = await searchParams
  const dias = parseInt(sp.dias ?? '7')

  // Geocodificar direcciones de locales pendientes (máx 3 por carga, con caché)
  await geocodificarNegociosPendientes()

  const [{ data: bitacora }, { data: activos }, { data: ipsPorUsuario }, { data: actividad }, { data: negociosMapa }] =
    await Promise.all([
      supabase.rpc('sa_bitacora', { p_dias: dias }),
      supabase.rpc('sa_usuarios_activos'),
      supabase.rpc('sa_ips_por_usuario', { p_dias: dias }),
      supabase.rpc('sa_actividad_dia'),
      supabase.rpc('sa_negocios_mapa'),
    ])

  const filas = (bitacora as BitacoraRow[] | null) ?? []
  const activosMap = Object.fromEntries(
    ((activos as ActiveRow[] | null) ?? []).map((r) => [r.periodo, r.cantidad]),
  )
  const ipFilas = (ipsPorUsuario as IpRow[] | null) ?? []
  const actividadHoy = (actividad as ActividadRow[] | null) ?? []
  const locales = ((negociosMapa as NegocioMapa[] | null) ?? []).filter((n) => !n.es_demo)

  // Geolocalizar todas las IPs vistas (con caché en ip_geo)
  const geoPorIp = await geolocalizarIps([
    ...ipFilas.flatMap((f) => f.ips),
    ...actividadHoy.flatMap((a) => a.ip_addresses),
  ])

  // Usuarios para el mapa: última IP del día con coordenadas conocidas
  const usuariosMapa: UsuarioMapa[] = []
  for (const a of actividadHoy) {
    const ipConGeo = [...a.ip_addresses]
      .reverse()
      .map((ip) => ({ ip, geo: geoPorIp[ip] }))
      .find((x) => x.geo?.lat != null && x.geo?.lon != null)
    if (!ipConGeo) continue
    const { ip, geo } = ipConGeo
    usuariosMapa.push({
      email: a.email_usuario ?? '—',
      rol: a.rol ? (ROL_LABEL[a.rol] ?? a.rol) : null,
      negocio: a.negocio_nombre,
      ip,
      lugar: geoTexto(geo),
      lat: geo!.lat!,
      lon: geo!.lon!,
      haceTexto: haceTexto(a.ultima_vista),
      distanciaKm:
        a.negocio_lat != null && a.negocio_lon != null
          ? distanciaKm(geo!.lat!, geo!.lon!, a.negocio_lat, a.negocio_lon)
          : null,
    })
  }

  const enLinea = actividadHoy.filter(
    (a) => Date.now() - new Date(a.ultima_vista).getTime() < 10 * 60000,
  ).length

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

      {/* ── Actividad de hoy por usuario ───────────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-sm font-bold text-white">Actividad de hoy</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Quién ha entrado hoy, cuánto tiempo lleva y desde dónde
              </p>
            </div>
          </div>
          {enLinea > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-1 text-[10px] font-bold text-emerald-400 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {enLinea} en línea
            </span>
          )}
        </div>

        {actividadHoy.length === 0 ? (
          <div className="py-10 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-700 mb-2" />
            <p className="text-sm text-slate-500">Nadie ha entrado hoy todavía</p>
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {actividadHoy.map((a) => {
              const activo = Date.now() - new Date(a.ultima_vista).getTime() < 10 * 60000
              const ultimaIp = a.ip_addresses[a.ip_addresses.length - 1]
              const lugar = ultimaIp ? geoTexto(geoPorIp[ultimaIp]) : null
              return (
                <div key={a.user_id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-violet-900/60 flex items-center justify-center text-sm font-bold text-violet-300 shrink-0">
                        {(a.email_usuario ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">
                          {a.email_usuario ?? '—'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                          <Store className="h-3 w-3 shrink-0" />
                          {a.negocio_nombre ?? 'Sin negocio'}
                          {a.rol && ` · ${ROL_LABEL[a.rol] ?? a.rol}`}
                        </p>
                      </div>
                    </div>
                    {activo ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 px-2 py-0.5 text-[9px] font-bold text-emerald-400 shrink-0 uppercase">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> En línea
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 shrink-0">{haceTexto(a.ultima_vista)}</span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-900 px-1 py-1.5">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500">Entró</p>
                      <p className="text-xs font-bold text-slate-300 tabular-nums">
                        {new Date(a.primera_vista).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900 px-1 py-1.5">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500">Tiempo activo</p>
                      <p className="text-xs font-bold text-slate-300 tabular-nums">
                        {duracionTexto(a.primera_vista, a.ultima_vista)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900 px-1 py-1.5">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500">Visitas</p>
                      <p className="text-xs font-bold text-slate-300 tabular-nums">{a.num_vistas}</p>
                    </div>
                  </div>
                  {ultimaIp && (
                    <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <MapPin className="h-3 w-3 text-amber-400 shrink-0" />
                      {lugar ?? 'Ubicación desconocida'}
                      <span className="font-mono text-[10px] text-slate-600">· {ultimaIp}</span>
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Mapa de locales y usuarios ─────────────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2.5">
          <MapIcon className="h-4 w-4 text-blue-400" />
          <div>
            <p className="text-sm font-bold text-white">Mapa de locales y usuarios</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Dónde están los locales registrados y desde dónde se conectaron hoy los usuarios
            </p>
          </div>
        </div>
        <div className="p-4">
          {locales.length === 0 && usuariosMapa.length === 0 ? (
            <div className="py-10 text-center">
              <MapIcon className="mx-auto h-8 w-8 text-slate-700 mb-2" />
              <p className="text-sm text-slate-500">Sin puntos que mostrar todavía</p>
              <p className="text-xs text-slate-600 mt-1">
                Escribe la dirección de cada negocio (con calle y ciudad) en su ficha para ubicar el local,
                y los usuarios aparecerán conforme entren a la app
              </p>
            </div>
          ) : (
            <MapaAccesos negocios={locales} usuarios={usuariosMapa} />
          )}
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
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Direcciones IP y ubicación
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
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {f.ips.map((ip) => {
                            const lugar = geoTexto(geoPorIp[ip])
                            return (
                              <span
                                key={ip}
                                className="inline-flex flex-col rounded bg-slate-800 px-1.5 py-0.5"
                              >
                                <span className="text-[10px] font-mono text-slate-400">{ip}</span>
                                {lugar && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-500">
                                    <MapPin className="h-2.5 w-2.5" />
                                    {lugar}
                                  </span>
                                )}
                              </span>
                            )
                          })}
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
