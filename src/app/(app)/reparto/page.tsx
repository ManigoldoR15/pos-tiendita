import { redirect } from 'next/navigation'
import { Truck, Users, Route, Radio, Clock, ShieldCheck, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { requireModulo } from '@/lib/modulos'
import { getRolActual } from '@/lib/rol'
import { hoyMX, mexicoDayRange, TZ } from '@/lib/fecha'
import { formatMXN } from '@/lib/dinero'
import { cn } from '@/lib/utils'
import MapaReparto, { type RutaPersona } from './mapa-reparto'
import AutoRefresh from './auto-refresh'
import MandarAviso from './mandar-aviso'

export const dynamic = 'force-dynamic'

// Paleta para distinguir personas en el mapa
const COLORES = ['#0d9488', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6', '#ec4899', '#84cc16', '#f97316']

function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}

function haceTexto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 2) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.floor(min / 60)} h ${min % 60} min`
}

function duracionTexto(min: number): string {
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

/**
 * Ajusta la secuencia de puntos GPS a la vialidad (snap-to-roads) con el
 * map-matching de OSRM. Si el servicio no responde, se usa el trazo crudo.
 */
async function ajustarACalles(puntos: [number, number][]): Promise<[number, number][]> {
  if (puntos.length < 2) return puntos
  // OSRM acepta máx ~100 coordenadas por petición — muestrear si hay más
  let muestra = puntos
  if (puntos.length > 95) {
    const paso = puntos.length / 95
    muestra = Array.from({ length: 95 }, (_, i) => puntos[Math.floor(i * paso)])
    muestra.push(puntos[puntos.length - 1])
  }
  try {
    const coords = muestra.map(([lat, lon]) => `${lon},${lat}`).join(';')
    const radios = muestra.map(() => '30').join(';')
    const res = await fetch(
      `https://router.project-osrm.org/match/v1/driving/${coords}?geometries=geojson&overview=full&radiuses=${radios}`,
      { signal: AbortSignal.timeout(3500), cache: 'no-store' },
    )
    if (!res.ok) return puntos
    const d = (await res.json()) as {
      code: string
      matchings?: { geometry: { coordinates: [number, number][] } }[]
    }
    if (d.code !== 'Ok' || !d.matchings?.length) return puntos
    const linea = d.matchings.flatMap((m) => m.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]))
    return linea.length > 1 ? linea : puntos
  } catch {
    return puntos // sin snap no se cae la página
  }
}

export default async function RepartoPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  await requireModulo('repartidores')
  const rol = await getRolActual()
  if (rol === 'empleado') redirect('/')

  const supabase = await createClient()
  const { start, end } = mexicoDayRange(hoyMX())

  const [{ data: puntos }, { data: miembros }, { data: ventasHoy }] = await Promise.all([
    supabase
      .from('rastro_gps')
      .select('user_id, lat, lon, precision_m, creado_en')
      .eq('negocio_id', negocio.id)
      .gte('creado_en', start)
      .lte('creado_en', end)
      .order('creado_en', { ascending: true })
      .limit(5000),
    supabase.rpc('get_miembros_negocio', { p_negocio_id: negocio.id }),
    supabase
      .from('ventas')
      .select('vendedor_id, total')
      .eq('negocio_id', negocio.id)
      .eq('estado', 'completada')
      .gte('created_at', start)
      .lte('created_at', end),
  ])

  // Lo cobrado hoy por cada persona (ventas hechas desde su rol)
  const cobradoPor = new Map<string, number>()
  for (const v of ventasHoy ?? []) {
    if (!v.vendedor_id) continue
    cobradoPor.set(v.vendedor_id, (cobradoPor.get(v.vendedor_id) ?? 0) + v.total)
  }

  const emailDe = new Map(
    ((miembros as { user_id: string; email: string }[] | null) ?? []).map((m) => [m.user_id, m.email]),
  )

  type Punto = { user_id: string; lat: number; lon: number; precision_m: number | null; creado_en: string }
  const porPersona = new Map<string, Punto[]>()
  for (const p of (puntos ?? []) as Punto[]) {
    const arr = porPersona.get(p.user_id) ?? []
    arr.push(p)
    porPersona.set(p.user_id, arr)
  }

  const rutas: RutaPersona[] = await Promise.all(
    [...porPersona.entries()].map(async ([uid, pts], i) => {
      let recorridoKm = 0
      for (let j = 1; j < pts.length; j++) {
        recorridoKm += distKm(pts[j - 1].lat, pts[j - 1].lon, pts[j].lat, pts[j].lon)
      }
      const crudos = pts.map((p) => [p.lat, p.lon] as [number, number])
      const primero = pts[0]
      const ultimo = pts[pts.length - 1]
      const durMin = Math.round(
        (new Date(ultimo.creado_en).getTime() - new Date(primero.creado_en).getTime()) / 60000,
      )
      // Movimiento en los últimos 15 min — para detectar "detenido"
      const hace15 = Date.now() - 15 * 60000
      const recientes = pts.filter((p) => new Date(p.creado_en).getTime() >= hace15)
      let movKm = 0
      for (let j = 1; j < recientes.length; j++) {
        movKm += distKm(recientes[j - 1].lat, recientes[j - 1].lon, recientes[j].lat, recientes[j].lon)
      }
      const activo = Date.now() - new Date(ultimo.creado_en).getTime() < 10 * 60000
      const estado: 'en_ruta' | 'detenido' | 'sin_senal' =
        !activo ? 'sin_senal' : recientes.length >= 3 && movKm < 0.15 ? 'detenido' : 'en_ruta'
      return {
        userId: uid,
        nombre: emailDe.get(uid)?.split('@')[0] ?? 'desconocido',
        color: COLORES[i % COLORES.length],
        linea: await ajustarACalles(crudos), // pegada a la vialidad
        inicioLat: primero.lat,
        inicioLon: primero.lon,
        ultimaLat: ultimo.lat,
        ultimaLon: ultimo.lon,
        precisionM: ultimo.precision_m,
        horaInicio: hora(primero.creado_en),
        horaUltima: hora(ultimo.creado_en),
        haceTexto: haceTexto(ultimo.creado_en),
        activo,
        estado,
        cobrado: cobradoPor.get(uid) ?? 0,
        recorridoKm,
        duracionMin: durMin,
        numPuntos: pts.length,
      }
    }),
  )
  rutas.sort((a, b) => Number(b.activo) - Number(a.activo) || b.recorridoKm - a.recorridoKm)

  const enRuta = rutas.filter((r) => r.activo).length
  const kmTotales = rutas.reduce((s, r) => s + r.recorridoKm, 0)

  // Situaciones que requieren la atención del dueño
  const atencion: string[] = []
  for (const r of rutas) {
    if (r.estado === 'detenido') {
      atencion.push(`${r.nombre} lleva más de 15 min sin moverse — está por ${r.horaUltima}`)
    } else if (r.estado === 'sin_senal') {
      atencion.push(`${r.nombre} dejó de reportar ${r.haceTexto} (app cerrada o sin señal)`)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <AutoRefresh segundos={60} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Truck className="h-5 w-5 text-primary" />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">Reparto</h1>
          <p className="text-sm text-muted-foreground">Monitoreo de tu flotilla en tiempo real</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          EN VIVO · cada 60 s
        </span>
      </div>

      {/* KPIs de flotilla */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-emerald-50/60 p-3 dark:bg-emerald-950/20">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Radio className="h-3 w-3" /> En ruta ahora
          </p>
          <p className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">{enRuta}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Users className="h-3 w-3" /> Con rastro hoy
          </p>
          <p className="text-2xl font-black tabular-nums">{rutas.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Route className="h-3 w-3" /> Km recorridos
          </p>
          <p className="text-2xl font-black tabular-nums">{kmTotales.toFixed(1)}</p>
        </div>
      </div>

      {/* Semáforo del centro de control: qué requiere tu atención */}
      {rutas.length > 0 &&
        (atencion.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Todo en orden</p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/70">
                Tu gente está reportando con normalidad. No hay nada que requiera tu atención.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {atencion.length} situación{atencion.length > 1 ? 'es' : ''} que revisar
            </p>
            <ul className="mt-1.5 space-y-1">
              {atencion.map((a) => (
                <li key={a} className="flex items-start gap-1.5 text-xs text-amber-700/90 dark:text-amber-400/80">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        ))}

      {rutas.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 px-5 py-16 text-center">
          <Truck className="h-10 w-10 text-muted-foreground/30" />
          <div>
            <p className="font-semibold">Sin rastro todavía hoy</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Los puntos aparecen cuando tus empleados o repartidores traen la app abierta
              con el permiso de ubicación aceptado (un punto cada minuto y medio).
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="card-soft overflow-hidden p-0">
            <MapaReparto rutas={rutas} />
          </div>

          {/* Tarjetas por persona */}
          <div className="grid gap-3 md:grid-cols-2">
            {rutas.map((r) => (
              <div key={r.userId} className="card-soft p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.nombre.substring(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.estado === 'en_ruta'
                        ? 'Reportando en vivo'
                        : r.estado === 'detenido'
                          ? 'Sin moverse hace rato'
                          : `Último reporte ${r.haceTexto}`}
                    </p>
                  </div>
                  <MandarAviso userId={r.userId} nombre={r.nombre} />
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                      r.estado === 'en_ruta' &&
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                      r.estado === 'detenido' &&
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                      r.estado === 'sin_senal' && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {r.estado === 'en_ruta' && (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    )}
                    {r.estado === 'en_ruta' ? 'En ruta' : r.estado === 'detenido' ? 'Detenido' : 'Sin señal'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 px-1 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Salió</p>
                    <p className="text-xs font-bold tabular-nums">{r.horaInicio}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-1 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Tiempo</p>
                    <p className="text-xs font-bold tabular-nums">{duracionTexto(r.duracionMin)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-1 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Recorrido</p>
                    <p className="text-xs font-bold tabular-nums">
                      {r.recorridoKm >= 0.1 ? `${r.recorridoKm.toFixed(1)} km` : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-1 py-1.5 dark:bg-emerald-950/30">
                    <p className="text-[9px] uppercase tracking-wider text-emerald-700/70 dark:text-emerald-400/70">
                      Cobrado
                    </p>
                    <p className="text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {r.cobrado > 0 ? formatMXN(r.cobrado) : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            La posición se reporta con la app abierta (cada 90 s, con permiso de ubicación).
            El trazo se ajusta a la vialidad automáticamente. Rastro conservado 30 días.
          </p>
        </>
      )}
    </div>
  )
}
