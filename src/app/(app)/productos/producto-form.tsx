'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { centavosATexto } from '@/lib/dinero'
import ComboboxCategoria from '@/components/combobox-categoria'
import CapturaLotes from '@/components/captura-lotes'
import type { ProductoState } from './actions'

type Categoria = { id: string; nombre: string }
type CategoriaPerecedero = {
  id: string
  nombre: string
  dias_refri: number | null
  dias_congelador: number | null
  dias_ambiente: number | null
}

type ProductoFormProps = {
  action: (prev: ProductoState, formData: FormData) => Promise<ProductoState>
  categorias: Categoria[]
  categoriasPerecedero?: CategoriaPerecedero[]
  hoy?: string
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
    unidad_medida?: string
    tara?: number | null
  }
}

export default function ProductoForm({
  action,
  categorias,
  categoriasPerecedero = [],
  hoy = '',
  titulo,
  inicial = {},
}: ProductoFormProps) {
  const [state, formAction, pending] = useActionState(action, null)
  const [tipoCaducidad, setTipoCaducidad] = useState<'envasado' | 'fresco'>('envasado')
  const [unidadMedida, setUnidadMedida] = useState(inicial.unidad_medida ?? 'pieza')
  const esNuevo = !inicial.id

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-black tracking-tight">{titulo}</h1>

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

        {/* Unidad de medida */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            Unidad de medida <span className="text-destructive">*</span>
          </label>
          <select
            name="unidad_medida"
            value={unidadMedida}
            onChange={(e) => setUnidadMedida(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="pieza">Pieza / unidad (abarrotes, latas, botellas…)</option>
            <option value="kg">Kilogramo (carnicería, granel pesado)</option>
            <option value="g">Gramo (especias, ingredientes pequeños)</option>
            <option value="litro">Litro (líquidos a granel)</option>
            <option value="ml">Mililitro (líquidos pequeños)</option>
          </select>
          {unidadMedida !== 'pieza' && (
            <p className="text-xs text-muted-foreground">
              Precio de venta = precio por {unidadMedida}. En el POS se pedirá la cantidad exacta al vender.
            </p>
          )}
        </div>

        {/* Tara del envase — solo para productos a granel */}
        {unidadMedida !== 'pieza' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Tara del envase ({unidadMedida}) <span className="text-muted-foreground font-normal">— opcional</span>
            </label>
            <div className="relative">
              <input
                name="tara"
                type="number"
                min="0"
                step={unidadMedida === 'g' || unidadMedida === 'ml' ? '1' : '0.001'}
                defaultValue={inicial.tara != null ? String(inicial.tara) : ''}
                placeholder="0.000"
                className="w-full rounded-lg border border-input bg-background px-3 py-3 pr-14 text-base outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {unidadMedida}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Peso del envase vacío. Con tara, en el cuadre puedes pesar el bote lleno y el sistema calcula el neto.
            </p>
          </div>
        )}

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

        {/* Existencias / lotes */}
        {esNuevo ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Tipo de manejo <span className="text-destructive">*</span>
              </label>
              <select
                name="tipo_caducidad"
                required
                value={tipoCaducidad}
                onChange={(e) => setTipoCaducidad(e.target.value as 'envasado' | 'fresco')}
                className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="envasado">Envasado / abarrotes (caducidad opcional)</option>
                <option value="fresco">Fresco / perecedero (caducidad calculada)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Lote inicial <span className="text-destructive">*</span>
              </label>
              <CapturaLotes tipo={tipoCaducidad} categorias={categoriasPerecedero} hoy={hoy} unidadMedida={unidadMedida} />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Existencias actuales</label>
            <p className="rounded-lg border border-input bg-muted px-3 py-3 text-base text-muted-foreground">
              {inicial.existencias ?? 0} {unidadMedida === 'pieza' ? 'unidades' : unidadMedida}
            </p>
            <p className="text-xs text-muted-foreground">
              Para agregar inventario usa &quot;Agregar lote&quot; desde la lista de productos.
            </p>
          </div>
        )}

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
