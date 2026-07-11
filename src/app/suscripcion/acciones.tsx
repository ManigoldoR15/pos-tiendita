'use client'

import { useState } from 'react'

// Botones de suscripción: piden la URL de Stripe al backend y redirigen.
export default function SuscripcionAcciones({
  yaSuscrito,
  configurado,
}: {
  yaSuscrito: boolean
  configurado: boolean
}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ir(ruta: string) {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(ruta, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'No se pudo continuar. Intenta de nuevo.')
        setCargando(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setCargando(false)
    }
  }

  if (!configurado) {
    return (
      <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        Los pagos en línea aún no están habilitados. Comunícate con soporte para activar tu
        suscripción.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {yaSuscrito ? (
        <button
          onClick={() => ir('/api/stripe/portal')}
          disabled={cargando}
          className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {cargando ? 'Abriendo…' : 'Administrar suscripción'}
        </button>
      ) : (
        <button
          onClick={() => ir('/api/stripe/checkout')}
          disabled={cargando}
          className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {cargando ? 'Redirigiendo…' : 'Suscribirme'}
        </button>
      )}
      {yaSuscrito && (
        <p className="text-center text-xs text-muted-foreground">
          Desde ahí puedes cambiar tu tarjeta, ver recibos o cancelar.
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
