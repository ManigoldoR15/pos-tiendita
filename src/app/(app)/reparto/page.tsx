import { redirect } from 'next/navigation'
import { Truck, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { requireModulo } from '@/lib/modulos'
import { getRolActual } from '@/lib/rol'
import { hoyMX, mexicoDayRange, TZ } from '@/lib/fecha'
import MapaReparto, { type RutaPersona } from './mapa-reparto'
import AutoRefresh from './auto-refresh'

export const dynamic = 'force-dynamic'

// Paleta para distinguir personas en el mapa
const COLORES = ['#0d9488', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6', '#ec4899', '#84cc16', '#f97316']

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
  if (min < 2) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.floor(min / 60)} h ${min % 60} min`
}

export default async function RepartoPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  await requireModulo('repartidores')
  const rol = await getRolActual()
  if (rol === 'empleado') redirect('/')

  const supabase = await createClient()
  const { start, end } = mexicoDayRange(hoyMX())

  const [{ data: puntos }, { data: miembros }] = await Promise.all([
    supabase
      .from('rastro_gps')
      .select('user_id, lat, lon, precision_m, creado_en')
      .eq('negocio_id', negocio.id)
      .gte('creado_en', start)
      .lte('creado_en', end)
      .order('creado_en', { ascending: true })
      .limit(5000),
    supabase.rpc('get_miembros_negocio', { p_negocio_id: negocio.id }),
  ])

  const emailDe = new Map(
    ((miembros as { user_id: string; email: string }[] | null) ?? []).map((m) => [m.user_id, m.email]),
  )

  // Agrupar el rastro por persona
  type Punto = { user_id: string; lat: number; lon: number; precision_m: number | null; creado_en: string }
  const porPersona = new Map<string, Punto[]>()
  for (const p of (puntos ?? []) as Punto[]) {
    const arr = porPersona.get(p.user_id) ?? []
    arr.push(p)
    porPersona.set(p.user_id, arr)
  }

  const rutas: RutaPersona[] = [...porPersona.entries()].map(([uid, pts], i) => {
    let recorridoKm = 0
    for (let j = 1; j < pts.length; j++) {
      recorridoKm += distanciaKm(pts[j - 1].lat, pts[j - 1].lon, pts[j].lat, pts[j].lon)
    }
    const ultimo = pts[pts.length - 1]
    return {
      userId: uid,
      nombre: emailDe.get(uid)?.split('@')[0] ?? 'desconocido',
      color: COLORES[i % COLORES.length],
      puntos: pts.map((p) => [p.lat, p.lon] as [number, number]),
      ultimaLat: ultimo.lat,
      ultimaLon: ultimo.lon,
      precisionM: ultimo.precision_m,
      ultimaVez: ultimo.creado_en,
      haceTexto: haceTexto(ultimo.creado_en),
      activo: Date.now() - new Date(ultimo.creado_en).getTime() < 10 * 60000,
      recorridoKm,
      numPuntos: pts.length,
    }
  }).sort((a, b) => new Date(b.ultimaVez).getTime() - new Date(a.ultimaVez).getTime())

  const activos = rutas.filter((r) => r.activo).length

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <AutoRefresh segundos={60} />

      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Truck className="h-5 w-5 text-primary" />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">Reparto</h1>
          <p className="text-sm text-muted-foreground">
            Dónde anda tu gente hoy y la ruta que ha recorrido · se actualiza solo cada minuto
          </p>
        </div>
        {activos > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {activos} en ruta
          </span>
        )}
      </div>

      {rutas.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 px-5 py-16 text-center">
          <Truck className="h-10 w-10 text-muted-foreground/30" />
          <div>
            <p className="font-semibold">Sin rastro todavía hoy</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Los puntos aparecen cuando tus empleados o repartidores traen la app abierta
              con el permiso de ubicación aceptado. Se marca un punto cada minuto y medio.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="card-soft overflow-hidden p-4">
            <MapaReparto rutas={rutas} />
          </div>

          {/* Resumen por persona */}
          <div className="card-soft overflow-hidden">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-semibold">Tu gente hoy</span>
            </div>
            <div className="divide-y">
              {rutas.map((r) => (
                <div key={r.userId} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.nombre.substring(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.recorridoKm >= 0.1
                        ? `${r.recorridoKm.toFixed(1)} km recorridos`
                        : 'Sin movimiento'}
                      {' · '}{r.numPuntos} punto{r.numPuntos !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {r.activo ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> En ruta
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">{r.haceTexto}</span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {new Date(r.ultimaVez).toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            La posición se reporta mientras la app esté abierta en el teléfono del empleado
            (un punto cada minuto y medio, con su permiso de ubicación). El rastro se conserva 30 días.
          </p>
        </>
      )}
    </div>
  )
}
