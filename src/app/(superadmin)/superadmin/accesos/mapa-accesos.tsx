'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap } from 'leaflet'

export type NegocioMapa = {
  id: string
  nombre: string
  ubicacion: string | null
  lat: number
  lon: number
  es_demo: boolean
  suspendido: boolean
  geo_fuente: 'direccion' | 'auto_ip' | null
}

export type UsuarioMapa = {
  email: string
  rol: string | null
  negocio: string | null
  ip: string
  lugar: string | null
  lat: number
  lon: number
  /** 'gps' = posición real del dispositivo; 'ip' = estimada por IP */
  fuente: 'gps' | 'ip'
  /** Precisión GPS en metros (solo fuente 'gps') */
  precisionM: number | null
  haceTexto: string
  /** Distancia en km a su negocio; null si el negocio no tiene coordenadas */
  distanciaKm: number | null
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

export default function MapaAccesos({
  negocios,
  usuarios,
}: {
  negocios: NegocioMapa[]
  usuarios: UsuarioMapa[]
}) {
  const contRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let cancelado = false

    async function init() {
      if (!contRef.current || mapRef.current) return
      const L = (await import('leaflet')).default
      if (cancelado || !contRef.current) return

      const map = L.map(contRef.current, {
        center: [23.6, -102.5], // centro de México
        zoom: 5,
        scrollWheelZoom: false,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map)

      const puntos: [number, number][] = []

      for (const n of negocios) {
        const icono = L.divIcon({
          className: '',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;background:#7c3aed;border:2px solid #c4b5fd;box-shadow:0 2px 6px rgba(0,0,0,.5);font-size:15px">🏪</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        })
        const origen =
          n.geo_fuente === 'auto_ip'
            ? 'Ubicación estimada por la IP del dueño'
            : n.geo_fuente === 'auto_gps'
              ? 'Ubicación por GPS del dueño'
              : (n.ubicacion ?? 'Local registrado')
        L.marker([n.lat, n.lon], { icon: icono })
          .addTo(map)
          .bindPopup(
            `<strong>${escapeHtml(n.nombre)}</strong>${n.es_demo ? ' (demo)' : ''}${n.suspendido ? ' — suspendido' : ''}<br/>` +
              `<span style="color:#64748b">${escapeHtml(origen)}</span><br/>` +
              `<a href="https://www.google.com/maps/search/?api=1&query=${n.lat},${n.lon}" target="_blank" rel="noopener" style="font-weight:600">Ver en Google Maps ↗</a>`,
          )
        puntos.push([n.lat, n.lon])
      }

      for (const u of usuarios) {
        const color =
          u.distanciaKm === null ? '#94a3b8' : u.distanciaKm <= 30 ? '#10b981' : '#ef4444'
        const esGps = u.fuente === 'gps'
        // GPS: punto con centro blanco (posición real); IP: punto sólido (estimada)
        const icono = L.divIcon({
          className: '',
          html: esGps
            ? `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2.5px solid rgba(255,255,255,.9);box-shadow:0 0 10px ${color};display:flex;align-items:center;justify-content:center"><div style="width:6px;height:6px;border-radius:50%;background:#fff"></div></div>`
            : `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2.5px solid rgba(255,255,255,.85);box-shadow:0 0 8px ${color}"></div>`,
          iconSize: esGps ? [18, 18] : [16, 16],
          iconAnchor: esGps ? [9, 9] : [8, 8],
        })
        const distTexto =
          u.distanciaKm === null
            ? 'Local sin ubicación registrada'
            : u.distanciaKm <= 30
              ? `A ~${Math.round(u.distanciaKm)} km de su local ✓`
              : `⚠ A ~${Math.round(u.distanciaKm)} km de su local`
        const fuenteTexto = esGps
          ? `📍 GPS real${u.precisionM ? ` (±${Math.round(u.precisionM)} m)` : ''}`
          : 'Estimado por IP (nivel ciudad)'
        const gmaps = `https://www.google.com/maps/search/?api=1&query=${u.lat},${u.lon}`
        L.marker([u.lat, u.lon], { icon: icono })
          .addTo(map)
          .bindPopup(
            `<strong>${escapeHtml(u.email)}</strong>${u.rol ? ` · ${escapeHtml(u.rol)}` : ''}<br/>` +
              `${escapeHtml(u.negocio ?? 'Sin negocio')}<br/>` +
              `<span style="color:#64748b">${escapeHtml(u.lugar ?? u.ip)} · ${escapeHtml(u.haceTexto)}</span><br/>` +
              `${escapeHtml(fuenteTexto)}<br/>` +
              `${distTexto}<br/>` +
              `<a href="${gmaps}" target="_blank" rel="noopener" style="font-weight:600">Ver en Google Maps ↗</a>`,
          )
        puntos.push([u.lat, u.lon])
      }

      if (puntos.length > 0) {
        map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 12 })
      }
    }

    void init()
    return () => {
      cancelado = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [negocios, usuarios])

  return (
    <div>
      <div ref={contRef} className="h-[420px] w-full rounded-xl overflow-hidden bg-slate-950" />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded-md bg-violet-600 border border-violet-300 text-[9px] text-center leading-4">🏪</span>
          Local del negocio
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
          Usuario cerca de su local (&le;30 km)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          Usuario lejos de su local
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-slate-400" />
          Local sin ubicación registrada
        </span>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Los puntos con centro blanco son GPS real del dispositivo (precisión de metros, requiere
        que el usuario acepte el permiso de ubicación). Los puntos sólidos se estiman por IP
        (nivel ciudad; con datos móviles pueden aparecer en otra ciudad).
      </p>
    </div>
  )
}
