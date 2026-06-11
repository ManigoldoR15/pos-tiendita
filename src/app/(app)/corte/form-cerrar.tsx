'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { formatMXN } from '@/lib/dinero'
import { cerrarCorteAction } from './actions'

export default function FormCerrarCorte({
  corteId,
  montoEsperado,
}: {
  corteId: string
  montoEsperado: number
}) {
  const [state, formAction, pending] = useActionState(cerrarCorteAction, null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="corte_id" value={corteId} />

      <div className="rounded-lg bg-muted px-4 py-3">
        <p className="text-sm text-muted-foreground">Efectivo esperado en caja</p>
        <p className="text-2xl font-bold">{formatMXN(montoEsperado)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Fondo inicial + ventas en efectivo
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Monto contado físicamente</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <input
            name="monto_contado"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full rounded-lg border border-input bg-background py-3 pl-7 pr-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button
        type="submit"
        disabled={pending}
        variant="destructive"
        className="w-full py-3 text-base"
      >
        {pending ? 'Cerrando...' : 'Confirmar cierre de caja'}
      </Button>
    </form>
  )
}
