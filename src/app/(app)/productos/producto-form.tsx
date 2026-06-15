'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { centavosATexto } from '@/lib/dinero'
import ComboboxCategoria from '@/components/combobox-categoria'
import type { ProductoState } from './actions'

type Categoria = { id: string; nombre: string }

type ProductoFormProps = {
  action: (prev: ProductoState, formData: FormData) => Promise<ProductoState>
  categorias: Categoria[]
  titulo: string
  inicial?: {
    id?: string
    nombre?: string
    precio_venta?: number
    precio_costo?: number | null
    categoria_id?: string | null
    existencias?: number
    codigo_barras?: string | null
    activo?: boolean
  }
}

export default function ProductoForm({
  action,
  categorias,
  titulo,
  inicial = {},
}: ProductoFormProps) {
  const [state, formAction, pending] = useActionState(action, null)

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">{titulo}</h1>

      <form action={formAction} className="flex flex-col gap-5">
        {inicial.id && <input type="hidden" name="id" value={inicial.id} />}

        {/* Nombre */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            Nombre <span className="text-destructive">*</span>
          </label>
          <input
            name="nombre"
            required
            defaultValue={inicial.nombre ?? ''}
            placeholder="Ej: Coca-Cola 600ml"
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Precio venta */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            Precio de venta (MXN) <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <input
              name="precio_venta"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={
                inicial.precio_venta !== undefined
                  ? centavosATexto(inicial.precio_venta)
                  : ''
              }
              placeholder="0.00"
              className="w-full rounded-lg border border-input bg-background py-3 pl-7 pr-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Precio costo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Precio de costo (MXN)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <input
              name="precio_costo"
              type="number"
              min="0"
              step="0.01"
              defaultValue={
                inicial.precio_costo != null
                  ? centavosATexto(inicial.precio_costo)
                  : ''
              }
              placeholder="0.00"
              className="w-full rounded-lg border border-input bg-background py-3 pl-7 pr-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <p className="text-xs text-muted-foreground">Para calcular márgenes y ganancia bruta</p>
        </div>

        {/* Código de barras */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Código de barras</label>
          <input
            name="codigo_barras"
            defaultValue={inicial.codigo_barras ?? ''}
            placeholder="Escanea o escribe el código EAN"
            autoComplete="off"
            className="rounded-lg border border-input bg-background px-3 py-3 text-base font-mono outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">Se usa en modo mostrador del POS con escáner</p>
        </div>

        {/* Categoría */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Categoría</label>
          <ComboboxCategoria
            categorias={categorias}
            placeholder="Sin categoría / escribe una nueva…"
            defaultCategoriaId={inicial.categoria_id ?? ''}
          />
        </div>

        {/* Existencias */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Existencias actuales</label>
          <input
            name="existencias"
            type="number"
            min="0"
            defaultValue={inicial.existencias ?? 0}
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Activo */}
        <label className="flex cursor-pointer items-center gap-3">
          <input
            name="activo"
            type="checkbox"
            defaultChecked={inicial.activo ?? true}
            className="h-5 w-5 rounded border-input accent-primary"
          />
          <span className="text-sm font-medium">Producto activo</span>
        </label>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={pending} className="flex-1 py-3 text-base">
            {pending ? 'Guardando...' : 'Guardar producto'}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/productos">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
