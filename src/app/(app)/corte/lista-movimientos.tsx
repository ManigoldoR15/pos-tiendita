'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatMXN } from '@/lib/dinero'
import { cn } from '@/lib/utils'
import { cancelarMovimientoCajaAction } from './actions'

export type MovimientoCaja = {
  id: string
  tipo: string
  monto: number
  motivo: string
  cancelado_en: string | null
}

export default function ListaMovimientos({ movimientos }: { movimientos: MovimientoCaja[] }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [pendiente, setPendiente] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function cancelar(id: string) {
    setError(null)
    setPendiente(id)
    const res = await cancelarMovimientoCajaAction(id)
    setPendiente(null)
    setConfirmando(null)
    if ('error' in res) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  if (movimientos.length === 0) return null

  return (
    <div className="card-soft overflow-hidden">
      <div className="border-b px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Movimientos del cajón
        </p>
      </div>

      {error && (
        <p className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="divide-y">
        {movimientos.map((m) => {
          const cancelado = m.cancelado_en !== null
          return (
            <div key={m.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn('truncate text-sm font-medium', cancelado && 'line-through opacity-50')}>
                    {m.motivo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cancelado
                      ? 'Cancelado — ya no cuenta en la caja'
                      : m.tipo === 'retiro' ? 'Salió del cajón' : 'Entró al cajón'}
                  </p>
                </div>
                <p className={cn(
                  'shrink-0 font-bold tabular-nums',
                  cancelado ? 'line-through opacity-50' : m.tipo === 'retiro' ? 'num-expense' : 'num-income',
                )}>
                  {m.tipo === 'retiro' ? '−' : '+'}{formatMXN(m.monto)}
                </p>
              </div>

              {!cancelado && (
                confirmando === m.id ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">¿Estuvo mal capturado?</span>
                    <button
                      onClick={() => cancelar(m.id)}
                      disabled={pendiente === m.id}
                      className="rounded-lg bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
                    >
                      {pendiente === m.id ? 'Cancelando…' : 'Sí, cancelar'}
                    </button>
                    <button
                      onClick={() => setConfirmando(null)}
                      className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-accent"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmando(m.id)}
                    className="mt-1 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Lo capturé mal
                  </button>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
