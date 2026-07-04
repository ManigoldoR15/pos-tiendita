import { createServiceClient } from '@/lib/supabase/service'
import type { GeoIp } from '@/lib/geoip'

type NominatimRow = { lat: string; lon: string }

/**
 * Auto-ubica negocios con la IP de su dueño: si el negocio no tiene dirección
 * geocodificada ('direccion'), sus coordenadas se estiman/refrescan con la
 * geolocalización de la última IP del dueño. La dirección escrita manda siempre.
 */
export async function autoUbicarNegocios(
  candidatos: { negocioId: string; geo: GeoIp }[],
): Promise<void> {
  if (candidatos.length === 0) return
  const svc = createServiceClient()
  await Promise.all(
    candidatos.map(({ negocioId, geo }) =>
      svc
        .from('negocios')
        .update({ lat: geo.lat, lon: geo.lon, geo_fuente: 'auto_ip' })
        .eq('id', negocioId)
        .or('geo_fuente.is.null,geo_fuente.eq.auto_ip'),
    ),
  )
}

const MAX_GEOCODE_POR_CARGA = 3

/**
 * Geocodifica (una sola vez) los negocios que tienen `ubicacion` escrita pero
 * aún no tienen coordenadas. Usa Nominatim (OpenStreetMap, gratis, 1 req/s).
 * Marca `geo_intentado_en` aunque falle para no reintentar en cada carga.
 */
export async function geocodificarNegociosPendientes(): Promise<void> {
  const svc = createServiceClient()
  const { data: pendientes } = await svc
    .from('negocios')
    .select('id, nombre, ubicacion')
    .not('ubicacion', 'is', null)
    .is('lat', null)
    .is('geo_intentado_en', null)
    .limit(MAX_GEOCODE_POR_CARGA)

  if (!pendientes || pendientes.length === 0) return

  for (const n of pendientes) {
    let lat: number | null = null
    let lon: number | null = null
    try {
      const q = encodeURIComponent(`${n.ubicacion}, México`)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=mx&q=${q}`,
        {
          headers: { 'User-Agent': 'pos-tiendita-superadmin/1.0' },
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        },
      )
      if (res.ok) {
        const rows = (await res.json()) as NominatimRow[]
        if (rows[0]) {
          lat = parseFloat(rows[0].lat)
          lon = parseFloat(rows[0].lon)
        }
      }
    } catch {
      // fallo silencioso — queda marcado como intentado
    }

    await svc
      .from('negocios')
      .update({
        lat, lon,
        geo_fuente: lat != null ? 'direccion' : null,
        geo_intentado_en: new Date().toISOString(),
      })
      .eq('id', n.id)

    // Política de uso de Nominatim: máximo 1 petición por segundo
    if (pendientes.indexOf(n) < pendientes.length - 1) {
      await new Promise((r) => setTimeout(r, 1100))
    }
  }
}
