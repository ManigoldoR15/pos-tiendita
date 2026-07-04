'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap } from 'leaflet'

export type RutaPersona = {
  userId: string
  nombre: string
  color: string
  puntos: [number, number][]
  ultimaLat: number
  ultimaLon: number
  precisionM: number | null
  ultimaVez: string
  haceTexto: string
  activo: boolean
  recorridoKm: number
  numPuntos: number
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

export default function MapaReparto({ rutas }: { rutas: RutaPersona[] }) {
  const contRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let cancelado = false

    async function init() {
      if (!contRef.current) return
      const L = (await import('leaflet')).default
      if (cancelado || !contRef.current) return

      // Recrear el mapa en cada refresh de datos (60 s) — barato y sin estados raros
      mapRef.current?.remove()
      const map = L.map(contRef.current, { center: [23.6, -102.5], zoom: 5, scrollWheelZoom: false })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      const bounds: [number, number][] = []

      for (const r of rutas) {
        // Ruta recorrida
        if (r.puntos.length > 1) {
          L.polyline(r.puntos, { color: r.color, weight: 3.5, opacity: 0.75 }).addTo(map)
        }
        // Posición actual: burbuja con iniciales
        const icono = L.divIcon({
          className: '',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:${r.color};color:#fff;font:700 11px sans-serif;border:2.5px solid rgba(255,255,255,.95);box-shadow:0 2px 8px rgba(0,0,0,.35)${r.activo ? `;outline:3px solid ${r.color}44` : ';opacity:.55'}">${escapeHtml(r.nombre.substring(0, 2).toUpperCase())}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        })
        L.marker([r.ultimaLat, r.ultimaLon], { icon: icono, zIndexOffset: 100 })
          .addTo(map)
          .bindPopup(
            `<strong>${escapeHtml(r.nombre)}</strong> ${r.activo ? '· en ruta' : ''}<br/>` +
              `<span style="color:#64748b">${escapeHtml(r.haceTexto)}${r.precisionM ? ` · ±${Math.round(r.precisionM)} m` : ''}</span><br/>` +
              `${r.recorridoKm >= 0.1 ? `${r.recorridoKm.toFixed(1)} km recorridos hoy<br/>` : ''}` +
              `<a href="https://www.google.com/maps/search/?api=1&query=${r.ultimaLat},${r.ultimaLon}" target="_blank" rel="noopener" style="font-weight:600">Ver en Google Maps ↗</a>`,
          )
        for (const p of r.puntos) bounds.push(p)
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds as [number, number][], { padding: [40, 40], maxZoom: 15 })
      }
    }

    void init()
    return () => {
      cancelado = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [rutas])

  return <div ref={contRef} className="h-[420px] w-full rounded-xl overflow-hidden bg-muted" />
}
