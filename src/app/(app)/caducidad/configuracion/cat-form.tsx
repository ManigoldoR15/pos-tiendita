'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import type { CatState } from '../actions'

type Props = {
  action: (prev: CatState, formData: FormData) => Promise<CatState>
}

export default function CatForm({ action }: Props) {
  const [state, formAction, pending] = useActionState(action, null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Nombre <span className="text-destructive">*</span>
        </label>
        <input
          name="nombre"
          required
          placeholder="Ej: Res cruda, Lácteos frescos…"
          className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Refri (días)</label>
          <input
            name="dias_refri"
            type="number"
            min="1"
            placeholder="—"
            className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Congelador (días)</label>
          <input
            name="dias_congelador"
            type="number"
            min="1"
            placeholder="—"
            className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Ambiente (días)</label>
          <input
            name="dias_ambiente"
            type="number"
            min="1"
            placeholder="—"
            className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Guardando…' : 'Agregar categoría'}
      </Button>
    </form>
  )
}
