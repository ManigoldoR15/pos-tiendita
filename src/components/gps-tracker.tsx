'use client'

import { useEffect } from 'react'
import { registrarGpsAction } from '@/lib/gps-actions'

const CADA_MS = 30 * 60 * 1000 // reportar como mucho cada 30 min
const REINTENTO_DENEGADO_MS = 7 * 24 * 60 * 60 * 1000 // si negó el permiso, no insistir en 7 días

/**
 * Reporta la posición GPS del dispositivo (con permiso del navegador) a la
 * bitácora de accesos. Invisible: no renderiza nada y falla en silencio.
 */
export default function GpsTracker() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return
    try {
      const ultimo = Number(localStorage.getItem('_gps_ult') ?? 0)
      if (Date.now() - ultimo < CADA_MS) return
      const denegado = Number(localStorage.getItem('_gps_no') ?? 0)
      if (Date.now() - denegado < REINTENTO_DENEGADO_MS) return
    } catch {
      return // sin localStorage no hay throttle — mejor no reportar
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try { localStorage.setItem('_gps_ult', String(Date.now())) } catch {}
        void registrarGpsAction(
          pos.coords.latitude,
          pos.coords.longitude,
          Math.round(pos.coords.accuracy),
        )
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          try { localStorage.setItem('_gps_no', String(Date.now())) } catch {}
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5 * 60 * 1000 },
    )
  }, [])

  return null
}
