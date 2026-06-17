'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import CapturaLotes from '@/components/captura-lotes'
import type { LoteState } from '../../../actions'

type CategoriaPerecedero = {
  id: string
  nombre: string
  dias_refri: number | null
  dias_congelador: number | null
  dias_ambiente: number | null
}

type Props = {
  action: (prev: LoteState, formData: FormData) => Promise<LoteState>
  producto: { id: string; nombre: string; tipo_caducidad: string | null; existencias: number; unidad_medida?: string }
  categoriasPerecedero: CategoriaPerecedero[]
  hoy: string
}

export default function ReabastoForm({ action, producto, categoriasPerecedero, hoy }: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const tipo = producto.tipo_caducidad === 'fresco' ? 'fresco' : 'envasado'

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">Agregar lote</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {producto.nombre} · Existencias actuales: {producto.existencias} {producto.unidad_medida ?? 'piezas'}
      </p>

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="producto_id" value={producto.id} />
        <CapturaLotes tipo={tipo} categorias={categoriasPerecedero} hoy={hoy} unidadMedida={producto.unidad_medida ?? 'pieza'} />

        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={pending} className="flex-1 py-3 text-base">
            {pending ? 'Guardando...' : 'Agregar lote'}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/productos">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
