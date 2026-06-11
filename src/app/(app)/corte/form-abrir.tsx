'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { abrirCorteAction } from './actions'

export default function FormAbrirCorte() {
  const [state, formAction, pending] = useActionState(abrirCorteAction, null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Fondo inicial en caja</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <input
            name="monto_inicial"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0.00"
            placeholder="0.00"
            className="w-full rounded-lg border border-input bg-background py-3 pl-7 pr-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Dinero con el que abres el turno (cambio disponible)
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="w-full py-3 text-base">
        {pending ? 'Abriendo...' : 'Abrir caja'}
      </Button>
    </form>
  )
}
