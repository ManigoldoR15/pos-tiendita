'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import ComboboxCategoria from '@/components/combobox-categoria'
import type { GastoState } from '../actions'

type Categoria = { id: string; nombre: string }

export default function GastoForm({
  action,
  categorias,
  fechaHoy,
}: {
  action: (prev: GastoState, formData: FormData) => Promise<GastoState>
  categorias: Categoria[]
  fechaHoy: string
}) {
  const [state, formAction, pending] = useActionState(action, null)

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Nuevo gasto</h1>

      <form action={formAction} className="flex flex-col gap-5">
        {/* Categoría */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            Categoría <span className="text-destructive">*</span>
          </label>
          <ComboboxCategoria
            categorias={categorias}
            placeholder="Selecciona o escribe categoría…"
            required
          />
        </div>

        {/* Monto */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            Monto (MXN) <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <input
              name="monto"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              className="w-full rounded-lg border border-input bg-background py-3 pl-7 pr-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Descripción */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Descripción (opcional)</label>
          <input
            name="descripcion"
            placeholder="Ej: Recibo de luz de julio"
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Fecha */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Fecha</label>
          <input
            name="fecha"
            type="date"
            defaultValue={fechaHoy}
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Es personal */}
        <label className="flex cursor-pointer items-center gap-3">
          <input
            name="es_personal"
            type="checkbox"
            className="h-5 w-5 rounded border-input accent-primary"
          />
          <span className="text-sm font-medium">Es gasto personal (no del negocio)</span>
        </label>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={pending} className="flex-1 py-3 text-base">
            {pending ? 'Guardando...' : 'Guardar gasto'}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/gastos">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
