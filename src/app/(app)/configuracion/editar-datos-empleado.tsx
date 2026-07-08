'use client'

import { useActionState, useState } from 'react'
import { editarDatosEmpleadoAction, type EmpleadoState } from './actions-empleados'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

type Props = {
  userId: string
  nombre: string | null
  edad: number | null
  sexo: string | null
}

export default function EditarDatosEmpleado({ userId, nombre, edad, sexo }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [state, action, pending] = useActionState<EmpleadoState, FormData>(
    editarDatosEmpleadoAction,
    null,
  )

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        title="Editar datos de la persona"
      >
        <Pencil className="h-3 w-3" />
        Datos
      </button>

      {abierto && (
        <form action={action} className="mt-2 rounded-lg border border-dashed p-3 space-y-3">
          <input type="hidden" name="user_id" value={userId} />

          {state?.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{state.error}</p>
          )}
          {state?.ok && (
            <p className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              ✓ {state.mensaje}
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Nombre completo</label>
            <input
              type="text"
              name="nombre_completo"
              defaultValue={nombre ?? ''}
              placeholder="Ej. María López García"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <div className="w-24">
              <label className="mb-1 block text-xs text-muted-foreground">Edad</label>
              <input
                type="number"
                name="edad"
                min={14}
                max={100}
                defaultValue={edad ?? ''}
                placeholder="Años"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Sexo</label>
              <select
                name="sexo"
                defaultValue={sexo ?? ''}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sin especificar</option>
                <option value="hombre">Hombre</option>
                <option value="mujer">Mujer</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <Button type="submit" disabled={pending} size="sm" className="w-full">
            {pending ? 'Guardando…' : 'Guardar datos'}
          </Button>
        </form>
      )}
    </div>
  )
}
