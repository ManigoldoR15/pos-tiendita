'use client'

import { useActionState, useState, useEffect } from 'react'
import { crearPlazaAction } from './actions'

const COLORES = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

export default function NuevaPlazaForm() {
  const [state, action, pending] = useActionState(crearPlazaAction, null)
  const [color, setColor] = useState('#6366f1')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        + Nueva plaza
      </button>
    )
  }

  return (
    <form
      action={action}
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      <input type="hidden" name="color" value={color} />
      <p className="text-sm font-semibold">Nueva plaza</p>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Nombre *</label>
        <input
          name="nombre"
          required
          placeholder="Ej: Plaza Norte, Local Centro…"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Dirección (opcional)</label>
        <input
          name="direccion"
          placeholder="Calle, colonia, ciudad…"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Color</label>
        <div className="flex gap-2">
          {COLORES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-primary' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Creando…' : 'Crear plaza'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false) }}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
