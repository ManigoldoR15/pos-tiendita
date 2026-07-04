import { createServiceClient } from '@/lib/supabase/service'

export type GeoIp = {
  ciudad: string | null
  region: string | null
  pais: string | null
}

/** Texto corto para mostrar junto a la IP: "Guadalajara, Jalisco" o "México". */
export function geoTexto(geo: GeoIp | undefined): string | null {
  if (!geo) return null
  const partes = [geo.ciudad, geo.region].filter(Boolean)
  if (partes.length === 0) return geo.pais
  return partes.join(', ')
}

const IP_PRIVADA = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|::ffff:127\.|fe80:|f[cd])/i

type IpApiBatchRow = {
  status: string
  query: string
  country?: string
  regionName?: string
  city?: string
  isp?: string
}

/**
 * Geolocaliza un conjunto de IPs. Lee primero la caché `ip_geo`; las que
 * falten se consultan en lote a ip-api.com (gratis, sin API key) y se cachean.
 * Fallo silencioso: si el servicio externo no responde, devuelve lo que haya.
 */
export async function geolocalizarIps(ips: string[]): Promise<Record<string, GeoIp>> {
  const resultado: Record<string, GeoIp> = {}
  const publicas: string[] = []

  for (const ip of new Set(ips.filter(Boolean))) {
    if (IP_PRIVADA.test(ip)) resultado[ip] = { ciudad: 'Red local', region: null, pais: null }
    else publicas.push(ip)
  }
  if (publicas.length === 0) return resultado

  const svc = createServiceClient()
  const { data: cache } = await svc
    .from('ip_geo')
    .select('ip, ciudad, region, pais')
    .in('ip', publicas)

  const faltantes = new Set(publicas)
  for (const fila of cache ?? []) {
    resultado[fila.ip] = { ciudad: fila.ciudad, region: fila.region, pais: fila.pais }
    faltantes.delete(fila.ip)
  }
  if (faltantes.size === 0) return resultado

  try {
    const lote = [...faltantes].slice(0, 100) // límite del endpoint batch
    const res = await fetch(
      'http://ip-api.com/batch?fields=status,query,country,regionName,city,isp&lang=es',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lote),
        signal: AbortSignal.timeout(4000),
        cache: 'no-store',
      },
    )
    if (!res.ok) return resultado

    const datos = (await res.json()) as IpApiBatchRow[]
    const filas = datos.map((d) => {
      const ok = d.status === 'success'
      const geo: GeoIp = ok
        ? { ciudad: d.city ?? null, region: d.regionName ?? null, pais: d.country ?? null }
        : { ciudad: null, region: null, pais: null }
      resultado[d.query] = geo
      return { ip: d.query, ...geo, isp: ok ? (d.isp ?? null) : null, ok }
    })
    if (filas.length > 0) await svc.from('ip_geo').upsert(filas)
  } catch {
    // Sin geo no se cae la página — se muestra solo la IP
  }
  return resultado
}
