'use client'

import { useActionState } from 'react'
import { type ProveedorState } from './actions'
import { Button } from '@/components/ui/button'

type Proveedor = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  notas: string | null
}

type Props = {
  action: (prev: ProveedorState, fd: FormData) => Promise<ProveedorState>
  proveedor?: Proveedor
  onCancel?: () => void
}

export default function FormProveedor({ action, proveedor, onCancel }: Props) {
  const [state, formAction, pending] = useActionState<ProveedorState, FormData>(action, null)

  return (
    <form action={formAction} className="space-y-3">
      {proveedor && <input type="hidden" name="id" value={proveedor.id} />}

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Nombre *</label>
          <input
            type="text"
            name="nombre"
            required
            defaultValue={proveedor?.nombre}
            placeholder="Ej. Distribuidora La Paloma"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Teléfono</label>
          <input
            type="tel"
            name="telefono"
            defaultValue={proveedor?.telefono ?? ''}
            placeholder="55 1234 5678"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            name="email"
            defaultValue={proveedor?.email ?? ''}
            placeholder="proveedor@ejemplo.com"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Notas</label>
          <textarea
            name="notas"
            defaultValue={proveedor?.notas ?? ''}
            rows={2}
            placeholder="Días de entrega, condiciones, etc."
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} size="sm">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={pending} size="sm">
          {pending ? 'Guardando…' : proveedor ? 'Actualizar' : 'Agregar proveedor'}
        </Button>
      </div>
    </form>
  )
}
