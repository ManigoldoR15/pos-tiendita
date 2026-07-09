'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { abonarApartadoAction, cancelarApartadoAction } from './actions'

export default function ApartadoAcciones({ apartadoId, saldo }: { apartadoId: string; saldo: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function abonar() {
    const texto = window.prompt(`Saldo pendiente: $${(saldo / 100).toFixed(2)}\n\n¿Cuánto abona el cliente? (MXN)`)
    if (!texto) return
    const monto = Math.round(parseFloat(texto) * 100)
    start(async () => {
      const r = await abonarApartadoAction(apartadoId, monto)
      if ('error' in r) setError(r.error)
      else router.refresh()
    })
  }

  function cancelar() {
    if (!window.confirm('¿Cancelar este apartado? La mercancía regresa al inventario. Los abonos ya recibidos se devuelven fuera del sistema.')) return
    start(async () => {
      const r = await cancelarApartadoAction(apartadoId)
      if ('error' in r) setError(r.error)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <button
          onClick={abonar}
          disabled={pending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Abonar
        </button>
        <button
          onClick={cancelar}
          disabled={pending}
          className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
