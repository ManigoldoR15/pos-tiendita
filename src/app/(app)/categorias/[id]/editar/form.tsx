'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { editarCategoriaAction } from '../../actions'

export default function FormEditarCategoria({
  id,
  nombreInicial,
}: {
  id: string
  nombreInicial: string
}) {
  const [state, action, pending] = useActionState(editarCategoriaAction, null)

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Nombre</label>
        <input
          name="nombre"
          required
          defaultValue={nombreInicial}
          placeholder="Ej: Bebidas"
          className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/categorias">Cancelar</Link>
        </Button>
      </div>
    </form>
  )
}
