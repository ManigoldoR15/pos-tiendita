'use client'

import { Trash2 } from 'lucide-react'
import { eliminarListaAction } from '@/app/actions/listas-precio'

export default function EliminarListaButton({ listaId, nombre }: { listaId: string; nombre: string }) {
  return (
    <form action={eliminarListaAction.bind(null, listaId)}>
      <button
        type="submit"
        title="Eliminar lista"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        onClick={(e) => {
          if (!confirm(`¿Eliminar "${nombre}"? Se borrarán todos sus precios.`)) e.preventDefault()
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </form>
  )
}
