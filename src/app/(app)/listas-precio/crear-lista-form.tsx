'use client'

import { useActionState } from 'react'
import { crearListaAction } from '@/app/actions/listas-precio'
import { cn } from '@/lib/utils'

export default function CrearListaForm() {
  const [error, action, pending] = useActionState(crearListaAction, null)

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Nombre <span className="text-destructive">*</span>
          </label>
          <input
            name="nombre"
            required
            placeholder="Ej: Mayoreo, VIP, Distribuidor…"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Descripción (opcional)</label>
          <input
            name="descripcion"
            placeholder="Ej: Precios para compras de 12+"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={cn(
          'rounded-xl px-5 py-2 text-sm font-semibold text-primary-foreground transition',
          pending ? 'bg-primary/60' : 'bg-primary hover:opacity-90',
        )}
      >
        {pending ? 'Creando…' : 'Crear lista'}
      </button>
    </form>
  )
}
