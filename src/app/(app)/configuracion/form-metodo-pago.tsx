'use client'

import { useActionState, useRef } from 'react'
import { agregarMetodoPagoAction } from './actions'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function FormMetodoPago() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    async (prev: Parameters<typeof agregarMetodoPagoAction>[0], formData: FormData) => {
      const result = await agregarMetodoPagoAction(prev, formData)
      if (result && 'success' in result) formRef.current?.reset()
      return result
    },
    null,
  )

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <div className="flex gap-3">
        <input
          name="nombre"
          required
          maxLength={60}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Ej: Vales de despensa"
        />
        <Button type="submit" disabled={pending} size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {pending ? 'Agregando…' : 'Agregar'}
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
