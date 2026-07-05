'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap } from 'leaflet'

export type RutaPersona = {
  userId: string
  nombre: string
  color: string
  /** Trazo ajustado a la vialidad (o crudo si el matching falló) */
  linea: [number, number][]
  inicioLat: number
  inicioLon: number
  ultimaLat: number
  ultimaLon: number
  precisionM: number | null
  horaInicio: string
  horaUltima: string
  haceTexto: string
  activo: boolean
  recorridoKm: number
  duracionMin: number
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

      // Tiles CARTO Voyager: limpios, tipo producto comercial
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map)

      const bounds: [number, number][] = []

      for (const r of rutas) {
        // Ruta: casing blanco debajo + línea de color encima (acabado pro)
        if (r.linea.length > 1) {
          L.polyline(r.linea, { color: '#ffffff', weight: 7, opacity: 0.9 }).addTo(map)
          L.polyline(r.linea, { color: r.color, weight: 4, opacity: 0.95 }).addTo(map)
        }

        // Punto de salida
        L.circleMarker([r.inicioLat, r.inicioLon], {
          radius: 5, color: '#fff', weight: 2, fillColor: r.color, fillOpacity: 1,
        })
          .addTo(map)
          .bindTooltip(`Salida ${r.horaInicio}`, { direction: 'top' })

        // Posición actual: burbuja con iniciales + etiqueta con nombre
        const icono = L.divIcon({
          className: '',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${r.color};color:#fff;font:700 12px system-ui;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.35)${r.activo ? '' : ';opacity:.55'}">${escapeHtml(r.nombre.substring(0, 2).toUpperCase())}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })
        const marker = L.marker([r.ultimaLat, r.ultimaLon], { icon: icono, zIndexOffset: 100 })
          .addTo(map)
          .bindTooltip(
            `<span style="font-weight:700">${escapeHtml(r.nombre)}</span>${r.activo ? ' 🟢' : ''}`,
            { permanent: true, direction: 'right', offset: [18, 0], opacity: 0.95 },
          )
          .bindPopup(
            `<strong>${escapeHtml(r.nombre)}</strong> ${r.activo ? '· en ruta' : '· detenido'}<br/>` +
              `<span style="color:#64748b">Salió ${escapeHtml(r.horaInicio)} · último ${escapeHtml(r.horaUltima)} (${escapeHtml(r.haceTexto)})</span><br/>` +
              `${r.recorridoKm >= 0.1 ? `${r.recorridoKm.toFixed(1)} km recorridos` : 'Sin movimiento'}` +
              `${r.precisionM ? ` · GPS ±${Math.round(r.precisionM)} m` : ''}<br/>` +
              `<a href="https://www.google.com/maps/search/?api=1&query=${r.ultimaLat},${r.ultimaLon}" target="_blank" rel="noopener" style="font-weight:600">Ver en Google Maps ↗</a>`,
          )
        void marker

        for (const p of r.linea) bounds.push(p)
        bounds.push([r.ultimaLat, r.ultimaLon])
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds as [number, number][], { padding: [50, 50], maxZoom: 15 })
      }
    }

    void init()
    return () => {
      cancelado = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [rutas])

  return <div ref={contRef} className="h-[460px] w-full bg-muted" />
}
