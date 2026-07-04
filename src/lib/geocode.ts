import { createServiceClient } from '@/lib/supabase/service'

type NominatimRow = { lat: string; lon: string }

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
