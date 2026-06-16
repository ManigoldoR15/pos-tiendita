'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import SelectorColorCategoria from '@/components/selector-color-categoria'
import { crearCategoriaAction } from './actions'

export default function FormNuevaCategoria() {
  const [state, action, pending] = useActionState(crearCategoriaAction, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    if (state === null) {
      formRef.current?.reset()
      setResetKey((k) => k + 1)
    }
  }, [state])

  return (
    <div className="flex flex-col gap-2">
      <form ref={formRef} action={action} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            name="nombre"
            required
            placeholder="Ej: Bebidas"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" disabled={pending}>
            {pending ? 'Agregando...' : 'Agregar'}
          </Button>
        </div>
        <SelectorColorCategoria key={resetKey} />
      </form>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </div>
  )
}
