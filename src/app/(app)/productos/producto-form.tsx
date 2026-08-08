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

type Plaza = { id: string; nombre: string }

type VarianteFila = { valor1: string; valor2: string; cantidad: string }

type ProductoFormProps = {
  action: (prev: ProductoState, formData: FormData) => Promise<ProductoState>
  categorias: Categoria[]
  categoriasPerecedero?: CategoriaPerecedero[]
  hoy?: string
  titulo: string
  /** plazas activas del negocio; con dos o más se elige dónde nace el stock */
  plazas?: Plaza[]
  /** true si el negocio tiene el módulo de variantes (giros tipo ropa) */
  moduloVariantes?: boolean
  /** variantes existentes, solo para mostrar al editar */
  variantesActuales?: { valor1: string; valor2: string | null; existencias: number }[]
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
    tiene_variantes?: boolean
    atributo1?: string | null
    atributo2?: string | null
  }
}

export default function ProductoForm({
  action,
  categorias,
  categoriasPerecedero = [],
  hoy = '',
  titulo,
  plazas = [],
  moduloVariantes = false,
  variantesActuales = [],
  inicial = {},
}: ProductoFormProps) {
  const [state, formAction, pending] = useActionState(action, null)
  const [tipoCaducidad, setTipoCaducidad] = useState<'envasado' | 'fresco'>('envasado')
  const [unidadMedida, setUnidadMedida] = useState(inicial.unidad_medida ?? 'pieza')
  const [conVariantes, setConVariantes] = useState(inicial.tiene_variantes ?? false)
  const [atributo1, setAtributo1] = useState(inicial.atributo1 ?? 'Talla')
  const [atributo2, setAtributo2] = useState(inicial.atributo2 ?? 'Color')
  const [usaAtributo2, setUsaAtributo2] = useState(
    inicial.id ? Boolean(inicial.atributo2) : true,
  )
  const [filas, setFilas] = useState<VarianteFila[]>([
    { valor1: '', valor2: '', cantidad: '' },
  ])
  const esNuevo = !inicial.id

  function setFila(i: number, campo: keyof VarianteFila, valor: string) {
    setFilas((f) => f.map((row, idx) => (idx === i ? { ...row, [campo]: valor } : row)))
  }

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

        {/* Variantes (talla/color) — solo con el módulo activo */}
        {moduloVariantes && esNuevo && (
          <div className="flex flex-col gap-3 rounded-xl border border-input p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                name="con_variantes"
                type="checkbox"
                checked={conVariantes}
                onChange={(e) => setConVariantes(e.target.checked)}
                className="h-5 w-5 rounded border-input accent-primary"
              />
              <span className="text-sm font-medium">
                Este producto tiene variantes (tallas, colores…)
              </span>
            </label>

            {conVariantes && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Atributo 1 *</label>
                    <input
                      name="atributo1"
                      value={atributo1}
                      onChange={(e) => setAtributo1(e.target.value)}
                      placeholder="Talla"
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={usaAtributo2}
                        onChange={(e) => setUsaAtributo2(e.target.checked)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      Atributo 2 (opcional)
                    </label>
                    <input
                      name="atributo2"
                      value={usaAtributo2 ? atributo2 : ''}
                      onChange={(e) => setAtributo2(e.target.value)}
                      disabled={!usaAtributo2}
                      placeholder="Color"
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-[1fr_1fr_5.5rem_2rem] items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span>{atributo1 || 'Atributo 1'}</span>
                    <span>{usaAtributo2 ? atributo2 || 'Atributo 2' : ''}</span>
                    <span>Cantidad</span>
                    <span />
                  </div>
                  {filas.map((fila, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_5.5rem_2rem] items-center gap-2">
                      <input
                        value={fila.valor1}
                        onChange={(e) => setFila(i, 'valor1', e.target.value)}
                        placeholder="M"
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        value={fila.valor2}
                        onChange={(e) => setFila(i, 'valor2', e.target.value)}
                        disabled={!usaAtributo2}
                        placeholder="Rojo"
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
                      />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={fila.cantidad}
                        onChange={(e) => setFila(i, 'cantidad', e.target.value)}
                        placeholder="0"
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setFilas((f) => f.filter((_, idx) => idx !== i))}
                        disabled={filas.length === 1}
                        className="text-lg text-muted-foreground hover:text-destructive disabled:opacity-30"
                        aria-label="Quitar variante"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFilas((f) => [...f, { valor1: '', valor2: '', cantidad: '' }])}
                    className="self-start rounded-lg border border-dashed border-input px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    + Agregar variante
                  </button>
                </div>

                <input
                  type="hidden"
                  name="variantes_json"
                  value={JSON.stringify(
                    filas
                      .filter((f) => f.valor1.trim())
                      .map((f) => ({
                        valor1: f.valor1.trim(),
                        valor2: usaAtributo2 ? f.valor2.trim() || null : null,
                        cantidad: Number(f.cantidad) || 0,
                      })),
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  El inventario se lleva por variante. La cantidad es la existencia inicial de cada una.
                </p>
              </>
            )}
          </div>
        )}

        {/* Variantes existentes (al editar): solo lectura */}
        {!esNuevo && inicial.tiene_variantes && (
          <div className="flex flex-col gap-2 rounded-xl border border-input p-4">
            <p className="text-sm font-medium">
              Variantes ({inicial.atributo1}
              {inicial.atributo2 ? ` / ${inicial.atributo2}` : ''})
            </p>
            <div className="flex flex-wrap gap-2">
              {variantesActuales.map((v, i) => (
                <span key={i} className="rounded-full bg-secondary px-3 py-1 text-xs">
                  {v.valor1}
                  {v.valor2 ? ` / ${v.valor2}` : ''} · {v.existencias}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Para agregar existencias a una variante usa &quot;Agregar lote&quot; desde la lista de productos.
            </p>
          </div>
        )}

        {/* Plaza donde entra el stock inicial — solo al crear y con varias plazas */}
        {esNuevo && plazas.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">¿Dónde entra este inventario?</label>
            <select
              name="local_id"
              className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">General (sin plaza)</option>
              {plazas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              El producto queda en el catálogo del negocio; lo que se guarda en una plaza
              es su mercancía. En General queda disponible para cualquiera.
            </p>
          </div>
        )}

        {/* Existencias / lotes */}
        {conVariantes && esNuevo ? null : esNuevo ? (
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
          <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm font-medium text-destructive">
            {state.error}
          </div>
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
