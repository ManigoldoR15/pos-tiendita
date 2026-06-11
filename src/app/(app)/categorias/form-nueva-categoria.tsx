'use client'

import { useActionState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { crearCategoriaAction } from './actions'

export default function FormNuevaCategoria() {
  const [state, action, pending] = useActionState(crearCategoriaAction, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state === null) formRef.current?.reset()
  }, [state])

  return (
    <div className="flex flex-col gap-1">
      <form ref={formRef} action={action} className="flex gap-2">
        <input
          name="nombre"
          required
          placeholder="Ej: Bebidas"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" disabled={pending}>
          {pending ? 'Agregando...' : 'Agregar'}
        </Button>
      </form>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </div>
  )
}
