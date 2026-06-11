'use client'

import { useActionState } from 'react'
import { actualizarNombreAction } from './actions'
import { Button } from '@/components/ui/button'

export default function FormNombre({ nombreActual }: { nombreActual: string }) {
  const [state, formAction, pending] = useActionState(actualizarNombreAction, null)

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex gap-3">
        <input
          name="nombre"
          defaultValue={nombreActual}
          required
          maxLength={80}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Nombre del negocio"
        />
        <Button type="submit" disabled={pending} size="sm">
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
      {state && 'error' in state && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state && 'success' in state && (
        <p className="text-sm text-green-600">{state.success}</p>
      )}
    </form>
  )
}
