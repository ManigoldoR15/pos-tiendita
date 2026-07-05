// Demo de flota para /reparto — genera rutas reales con paradas (hoy) en la
// Tienda de Prueba E2E. Rutas por OSRM público; paradas = clusters quietos.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// ── env ──────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
})

const NEGOCIO = 'b535d152-70a5-44cf-8ab0-dbe42633872e'
const BODEGA = [20.0930, -98.3690] // Tulancingo, Hidalgo

// Cada "camión": usuario + waypoints (bodega + tiendas) + cómo termina
const CAMIONES = [
  {
    user: '6691f84c-bb5f-4af8-acc0-0844c93356f3', // test-empleado → "en ruta"
    waypoints: [BODEGA, [20.1015, -98.3605], [20.1050, -98.3760], [20.0980, -98.3820]],
    endOffsetMin: 2,
    endOnDrive: true, // termina manejando = en ruta ahora
  },
  {
    user: '8f0b795d-a851-4530-829d-9152397bb652', // emp-… → "detenido / ahí ahora"
    waypoints: [BODEGA, [20.0855, -98.3520], [20.0790, -98.3630], [20.0740, -98.3720], [20.0805, -98.3805]],
    endOffsetMin: 3,
    endOnDrive: false, // termina en una parada = detenido
  },
  {
    user: '009af41e-de42-484e-ba70-15c037008066', // test-admin → "sin señal" (ya terminó)
    waypoints: [BODEGA, [20.1005, -98.3555], [20.1080, -98.3650], [20.0940, -98.3560]],
    endOffsetMin: 41,
    endOnDrive: false,
  },
]

const PASO_SEG = 90 // cadencia real del tracker
const jitter = () => (Math.random() - 0.5) * 0.0004 // ±~20 m

async function osrmLeg(a, b) {
  const url = `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  const d = await res.json()
  if (d.code !== 'Ok' || !d.routes?.length) throw new Error('OSRM: ' + d.code)
  return {
    coords: d.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    durSeg: d.routes[0].duration,
  }
}

function muestrear(coords, n) {
  if (n <= 1) return [coords[coords.length - 1]]
  const out = []
  for (let i = 0; i < n; i++) out.push(coords[Math.floor((i / (n - 1)) * (coords.length - 1))])
  return out
}

async function construir(cam) {
  const pts = [] // { lat, lon, tRel }  (tRel = segundos desde inicio)
  let t = 0
  // carga en bodega: 10 min
  const cargaK = Math.round((10 * 60) / PASO_SEG)
  for (let k = 0; k < cargaK; k++) { pts.push({ lat: BODEGA[0] + jitter(), lon: BODEGA[1] + jitter(), tRel: t }); t += PASO_SEG }

  for (let i = 0; i < cam.waypoints.length - 1; i++) {
    const leg = await osrmLeg(cam.waypoints[i], cam.waypoints[i + 1])
    const nDrive = Math.max(2, Math.round(leg.durSeg / PASO_SEG))
    for (const [lat, lon] of muestrear(leg.coords, nDrive)) { pts.push({ lat, lon, tRel: t }); t += PASO_SEG }

    const esUltima = i === cam.waypoints.length - 2
    if (esUltima && cam.endOnDrive) break // termina manejando
    // parada en la tienda: 8–14 min
    const stopMin = 8 + Math.floor(Math.random() * 7)
    const stopK = Math.round((stopMin * 60) / PASO_SEG)
    const dest = cam.waypoints[i + 1]
    for (let k = 0; k < stopK; k++) { pts.push({ lat: dest[0] + jitter(), lon: dest[1] + jitter(), tRel: t }); t += PASO_SEG }
  }

  // anclar el final a "hace endOffsetMin" respecto a ahora
  const total = pts[pts.length - 1].tRel
  const finMs = Date.now() - cam.endOffsetMin * 60000
  const inicioMs = finMs - total * 1000
  return pts.map((p) => ({
    negocio_id: NEGOCIO,
    user_id: cam.user,
    lat: p.lat,
    lon: p.lon,
    precision_m: 8 + Math.random() * 12,
    creado_en: new Date(inicioMs + p.tRel * 1000).toISOString(),
  }))
}

// ── ejecutar ─────────────────────────────────────────────────────────────────
const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0)
for (const cam of CAMIONES) {
  await supabase.from('rastro_gps').delete()
    .eq('negocio_id', NEGOCIO).eq('user_id', cam.user).gte('creado_en', hoyInicio.toISOString())
}
let totalIns = 0
for (const cam of CAMIONES) {
  const rows = await construir(cam)
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('rastro_gps').insert(rows.slice(i, i + 500))
    if (error) { console.error('insert error', error.message); process.exit(1) }
  }
  totalIns += rows.length
  console.log(`camión ${cam.user.slice(0, 8)} → ${rows.length} puntos`)
}
console.log(`\nOK: ${totalIns} puntos insertados en la flota demo.`)
