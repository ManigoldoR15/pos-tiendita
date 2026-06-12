'use client'

import { useActionState } from 'react'
import { agregarEmpleadoAction, type EmpleadoState } from './actions-empleados'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'

export default function FormEmpleado() {
  const [state, action, pending] = useActionState<EmpleadoState, FormData>(
    agregarEmpleadoAction,
    null,
  )

  return (
    <form action={action} className="space-y-2">
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-green-600">Empleado agregado correctamente.</p>
      )}
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="correo@ejemplo.com"
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" disabled={pending} size="sm">
          <UserPlus className="h-4 w-4" />
          {pending ? 'Buscando…' : 'Invitar'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        El usuario debe tener cuenta registrada en la aplicación.
      </p>
    </form>
  )
}
