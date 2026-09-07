import { createServiceClient } from '@/lib/supabase/service'

type NominatimRow = { lat: string; lon: string; addresstype?: string; place_rank?: number }

// Nominatim contesta a "Monclova, Coahuila" con el CENTROIDE del municipio
// (boundary/administrative), no con la ciudad. El municipio de Monclova mide
// 61 km de ancho, así que su centroide cae en el cerro, a 22 km del centro.
// Estos tipos de resultado son polígonos administrativos: sirven para pintar
// un país, no para saber dónde está una tiendita.
const TIPOS_DEMASIADO_GRUESOS = new Set(['country', 'state', 'province', 'county', 'region'])

function esDemasiadoGrueso(r: NominatimRow): boolean {
  return TIPOS_DEMASIADO_GRUESOS.has(r.addresstype ?? '') || (r.place_rank ?? 99) <= 12
}

/**
 * Saca coordenadas de lo que el dueño pegue en el campo de dirección: el
 * "26.9063, -101.4195" que manda WhatsApp al compartir ubicación, o un link de
 * Google Maps. Es la única forma de tener precisión de metros sin depender de
 * que la persona acepte el permiso de GPS en su navegador.
 */
export function parsearCoordenadas(texto: string): { lat: number; lon: number } | null {
  const t = texto.trim()

  // Link de Google Maps. El !3d/!4d es la coordenada DEL LUGAR; el @ es solo
  // el centro de la pantalla, así que el primero gana cuando vienen los dos.
  const deLink =
    t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ??
    t.match(/[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) ??
    t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ??
    t.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i)

  // Coordenadas peladas: "26.9063, -101.4195"
  const crudo = deLink ?? t.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/)
  if (!crudo) return null

  const lat = parseFloat(crudo[1])
  const lon = parseFloat(crudo[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  // Sin decimales no es una ubicación, es un número suelto (evita "25, 100")
  if (Number.isInteger(lat) && Number.isInteger(lon)) return null
  return { lat, lon }
}

/**
 * Auto-ubica negocios con la posición de su dueño: GPS si dio permiso
 * (fuente 'auto_gps'), si no la geolocalización de su última IP ('auto_ip').
 * Jerarquía: 'direccion' (escrita en la ficha) > 'auto_gps' > 'auto_ip'.
 */
export async function autoUbicarNegocios(
  candidatos: { negocioId: string; lat: number; lon: number; fuente: 'auto_gps' | 'auto_ip' }[],
): Promise<void> {
  if (candidatos.length === 0) return
  const svc = createServiceClient()
  await Promise.all(
    candidatos.map(({ negocioId, lat, lon, fuente }) =>
      svc
        .from('negocios')
        .update({ lat, lon, geo_fuente: fuente })
        .eq('id', negocioId)
        .or(
          fuente === 'auto_gps'
            ? 'geo_fuente.is.null,geo_fuente.eq.auto_ip,geo_fuente.eq.auto_gps'
            : 'geo_fuente.is.null,geo_fuente.eq.auto_ip',
        ),
    ),
  )
}

const MAX_GEOCODE_POR_CARGA = 3

/**
 * Geocodifica los negocios con `ubicacion` escrita que aún no tienen una
 * coordenada sacada de esa dirección. Usa Nominatim (OpenStreetMap, gratis,
 * 1 req/s). Marca `geo_intentado_en` aunque falle para no reintentar en cada
 * carga; el trigger de la migración 077 lo limpia si corrigen la dirección.
 *
 * Incluye a los que ya tienen coordenada estimada por IP: la dirección escrita
 * manda sobre la IP (que solo acierta la ciudad, y a veces ni eso).
 */
export async function geocodificarNegociosPendientes(): Promise<void> {
  const svc = createServiceClient()
  const { data: pendientes } = await svc
    .from('negocios')
    .select('id, nombre, ubicacion')
    .not('ubicacion', 'is', null)
    .is('geo_intentado_en', null)
    .or('geo_fuente.is.null,geo_fuente.eq.auto_ip')
    .limit(MAX_GEOCODE_POR_CARGA)

  if (!pendientes || pendientes.length === 0) return

  for (const n of pendientes) {
    let lat: number | null = null
    let lon: number | null = null

    // Si pegaron coordenadas o un link de Google Maps, eso manda: es exacto y
    // no hay que preguntarle nada a Nominatim.
    const pegadas = parsearCoordenadas(n.ubicacion ?? '')
    if (pegadas) {
      lat = pegadas.lat
      lon = pegadas.lon
    } else {
      try {
        const q = encodeURIComponent(`${n.ubicacion}, México`)
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=mx&q=${q}`,
          {
            headers: { 'User-Agent': 'pos-tiendita-superadmin/1.0' },
            signal: AbortSignal.timeout(5000),
            cache: 'no-store',
          },
        )
        if (res.ok) {
          const rows = (await res.json()) as NominatimRow[]
          // Preferir una calle/colonia sobre el polígono del municipio
          const elegido = rows.find((r) => !esDemasiadoGrueso(r)) ?? rows[0]
          if (elegido) {
            lat = parseFloat(elegido.lat)
            lon = parseFloat(elegido.lon)
          }
        }
      } catch {
        // fallo silencioso — queda marcado como intentado
      }
    }

    // Si falló, solo se sella el intento: NO se borran las coordenadas que ya
    // tuviera (la estimación por IP es mala, pero es mejor que nada en el mapa).
    await svc
      .from('negocios')
      .update({
        ...(lat != null && lon != null ? { lat, lon, geo_fuente: 'direccion' } : {}),
        geo_intentado_en: new Date().toISOString(),
      })
      .eq('id', n.id)

    // Política de uso de Nominatim: máximo 1 petición por segundo
    if (!pegadas && pendientes.indexOf(n) < pendientes.length - 1) {
      await new Promise((r) => setTimeout(r, 1100))
    }
  }
}
