'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { registrarGpsAction } from '@/lib/gps-actions'

const CADA_MS = 30 * 60 * 1000 // reportar como mucho cada 30 min
const REINTENTO_DENEGADO_MS = 7 * 24 * 60 * 60 * 1000 // si dijo "ahora no", no insistir en 7 días

function obtenerYReportar(alTerminar?: () => void) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      try { localStorage.setItem('_gps_ult', String(Date.now())) } catch {}
      void registrarGpsAction(
        pos.coords.latitude,
        pos.coords.longitude,
        Math.round(pos.coords.accuracy),
      )
      alTerminar?.()
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        try { localStorage.setItem('_gps_no', String(Date.now())) } catch {}
      }
      alTerminar?.()
    },
    { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5 * 60 * 1000 },
  )
}

/**
 * Reporta la posición GPS a la bitácora. Si el permiso aún no se ha concedido,
 * muestra primero una tarjeta amigable propia; el aviso nativo del navegador
 * solo se dispara cuando el usuario acepta aquí (y una vez concedido, ya no
 * vuelve a aparecer nunca — los reportes siguientes son silenciosos).
 */
export default function GpsTracker() {
  const [mostrarTarjeta, setMostrarTarjeta] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return
    try {
      const ultimo = Number(localStorage.getItem('_gps_ult') ?? 0)
      if (Date.now() - ultimo < CADA_MS) return
      const rechazado = Number(localStorage.getItem('_gps_no') ?? 0)
      if (Date.now() - rechazado < REINTENTO_DENEGADO_MS) return
    } catch {
      return
    }

    if (!('permissions' in navigator)) {
      setMostrarTarjeta(true)
      return
    }
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((estado) => {
        if (estado.state === 'granted') obtenerYReportar() // silencioso, sin avisos
        else if (estado.state === 'prompt') setMostrarTarjeta(true)
        // 'denied': el navegador lo tiene bloqueado — no molestar
      })
      .catch(() => setMostrarTarjeta(true))
  }, [])

  if (!mostrarTarjeta) return null

  function aceptar() {
    setMostrarTarjeta(false)
    obtenerYReportar()
  }

  function ahoraNo() {
    setMostrarTarjeta(false)
    try { localStorage.setItem('_gps_no', String(Date.now())) } catch {}
  }

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 md:inset-x-auto md:right-4 md:bottom-4 md:w-80">
      <div className="rounded-2xl border bg-card text-card-foreground shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">¿Nos permites usar tu ubicación?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sirve para ubicar tu tienda en el mapa y proteger tu cuenta.
              Tu navegador te pedirá confirmarlo.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={aceptar}
            className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Sí, permitir
          </button>
          <button
            onClick={ahoraNo}
            className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
