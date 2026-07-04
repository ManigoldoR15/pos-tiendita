import { createServiceClient } from '@/lib/supabase/service'

export type GeoIp = {
  ciudad: string | null
  region: string | null
  pais: string | null
  lat: number | null
  lon: number | null
}

/** Texto corto para mostrar junto a la IP: "Guadalajara, Jalisco" o "México". */
export function geoTexto(geo: GeoIp | undefined): string | null {
  if (!geo) return null
  const partes = [geo.ciudad, geo.region].filter(Boolean)
  if (partes.length === 0) return geo.pais
  return partes.join(', ')
}

const IP_PRIVADA = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|::ffff:127\.|fe80:|f[cd])/i

type IpWhoIsRow = {
  success: boolean
  country?: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
  connection?: { isp?: string }
}

const MAX_LOOKUPS_POR_CARGA = 12

/**
 * Geolocaliza un conjunto de IPs. Lee primero la caché `ip_geo`; las que
 * falten se consultan a ipwho.is (HTTPS, gratis, sin API key) y se cachean.
 * Fallo silencioso: si el servicio externo no responde, devuelve lo que haya.
 */
export async function geolocalizarIps(ips: string[]): Promise<Record<string, GeoIp>> {
  const resultado: Record<string, GeoIp> = {}
  const publicas: string[] = []

  for (const ip of new Set(ips.filter(Boolean))) {
    if (IP_PRIVADA.test(ip)) {
      resultado[ip] = { ciudad: 'Red local', region: null, pais: null, lat: null, lon: null }
    } else {
      publicas.push(ip)
    }
  }
  if (publicas.length === 0) return resultado

  const svc = createServiceClient()
  const { data: cache } = await svc
    .from('ip_geo')
    .select('ip, ciudad, region, pais, lat, lon')
    .in('ip', publicas)

  const faltantes = new Set(publicas)
  for (const fila of cache ?? []) {
    resultado[fila.ip] = {
      ciudad: fila.ciudad, region: fila.region, pais: fila.pais,
      lat: fila.lat, lon: fila.lon,
    }
    faltantes.delete(fila.ip)
  }
  if (faltantes.size === 0) return resultado

  const lote = [...faltantes].slice(0, MAX_LOOKUPS_POR_CARGA)
  const filas: (GeoIp & { ip: string; isp: string | null; ok: boolean })[] = []

  await Promise.all(
    lote.map(async (ip) => {
      try {
        const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?lang=es`, {
          signal: AbortSignal.timeout(4000),
          cache: 'no-store',
        })
        if (!res.ok) return
        const d = (await res.json()) as IpWhoIsRow
        const geo: GeoIp = d.success
          ? {
              ciudad: d.city ?? null, region: d.region ?? null, pais: d.country ?? null,
              lat: d.latitude ?? null, lon: d.longitude ?? null,
            }
          : { ciudad: null, region: null, pais: null, lat: null, lon: null }
        resultado[ip] = geo
        filas.push({ ip, ...geo, isp: d.success ? (d.connection?.isp ?? null) : null, ok: !!d.success })
      } catch {
        // Sin geo no se cae la página — se muestra solo la IP
      }
    }),
  )

  if (filas.length > 0) await svc.from('ip_geo').upsert(filas)
  return resultado
}
