'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Plus, Trash2, Tag, ArrowDown, ArrowUp } from 'lucide-react'
import { upsertItemAction, eliminarItemAction } from '@/app/actions/listas-precio'
import { formatMXN, textoCentavos, centavosATexto } from '@/lib/dinero'

type Producto = { id: string; nombre: string; precio_venta: number; unidad_medida: string }
type ItemActual = { id: string; producto_id: string; precio: number }

export default function ListaItemsManager({
  listaId,
  listaNombre,
  productos,
  itemsActuales,
}: {
  listaId: string
  listaNombre: string
  productos: Producto[]
  itemsActuales: ItemActual[]
}) {
  const [busqueda, setBusqueda] = useState('')
  const [sugerencias, setSugerencias] = useState<Producto[]>([])
  const [showSug, setShowSug] = useState(false)
  const [pendingError, setPendingError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sugRef = useRef<HTMLDivElement>(null)

  const itemMap = useMemo(
    () => new Map(itemsActuales.map((i) => [i.producto_id, i])),
    [itemsActuales],
  )

  // Productos ya en la lista (para mostrar y editar)
  const itemsConProducto = useMemo(
    () =>
      itemsActuales
        .map((item) => ({ item, prod: productos.find((p) => p.id === item.producto_id) }))
        .filter((x) => x.prod !== undefined) as { item: ItemActual; prod: Producto }[],
    [itemsActuales, productos],
  )

  useEffect(() => {
    if (busqueda.trim().length < 1) {
      setSugerencias([])
      return
    }
    const q = busqueda.toLowerCase()
    setSugerencias(
      productos
        .filter((p) => p.nombre.toLowerCase().includes(q) && !itemMap.has(p.id))
        .slice(0, 8),
    )
  }, [busqueda, productos, itemMap])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        sugRef.current &&
        !sugRef.current.contains(e.target as Node) &&
        inputRef.current !== e.target
      )
        setShowSug(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleAgregar(prod: Producto) {
    setBusqueda('')
    setSugerencias([])
    setShowSug(false)
    const fd = new FormData()
    fd.set('lista_id', listaId)
    fd.set('producto_id', prod.id)
    fd.set('precio', centavosATexto(prod.precio_venta))
    const err = await upsertItemAction(null, fd)
    if (err) setPendingError(err)
  }

  async function handleGuardarPrecio(item: ItemActual, nuevoPrecioText: string) {
    const fd = new FormData()
    fd.set('lista_id', listaId)
    fd.set('producto_id', item.producto_id)
    fd.set('precio', nuevoPrecioText)
    const err = await upsertItemAction(null, fd)
    if (err) setPendingError(err)
  }

  async function handleEliminar(item: ItemActual) {
    await eliminarItemAction(item.id, listaId)
  }

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="card-soft p-5">
        <p className="mb-3 text-sm font-semibold">
          Agregar producto a &ldquo;{listaNombre}&rdquo;
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setShowSug(true) }}
            onFocus={() => busqueda.length > 0 && setShowSug(true)}
            placeholder="Buscar producto…"
            className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {showSug && sugerencias.length > 0 && (
            <div
              ref={sugRef}
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border bg-card shadow-lg"
            >
              {sugerencias.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAgregar(p)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="flex-1">{p.nombre}</span>
                  <span className="text-xs text-muted-foreground">{formatMXN(p.precio_venta)}</span>
                </button>
              ))}
            </div>
          )}
          {busqueda.trim().length > 0 && sugerencias.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Sin coincidencias disponibles (ya está en la lista o no existe).
            </p>
          )}
        </div>
        {pendingError && (
          <p className="mt-2 text-sm text-destructive">{pendingError}</p>
        )}
      </div>

      {/* Items actuales */}
      {itemsConProducto.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 py-14 text-center">
          <Tag className="h-9 w-9 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Ningún producto tiene precio especial aún.<br />
            Busca un producto arriba para agregar su precio de esta lista.
          </p>
        </div>
      ) : (
        <div className="card-soft overflow-hidden">
          <div className="border-b px-5 py-3 text-sm font-semibold">
            {itemsConProducto.length} producto{itemsConProducto.length !== 1 ? 's' : ''} con precio especial
          </div>
          <div className="divide-y">
            {itemsConProducto.map(({ item, prod }) => {
              const diff = item.precio - prod.precio_venta
              const pct = prod.precio_venta > 0
                ? Math.round((diff / prod.precio_venta) * 100)
                : 0
              return (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{prod.nombre}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Normal: {formatMXN(prod.precio_venta)}</span>
                      {diff !== 0 && (
                        <span className={
                          diff < 0
                            ? 'flex items-center gap-0.5 text-green-600'
                            : 'flex items-center gap-0.5 text-amber-600'
                        }>
                          {diff < 0
                            ? <ArrowDown className="h-3 w-3" />
                            : <ArrowUp className="h-3 w-3" />
                          }
                          {Math.abs(pct)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Precio editable */}
                  <div className="flex items-center gap-2">
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={centavosATexto(item.precio)}
                        onBlur={(e) => handleGuardarPrecio(item, e.target.value)}
                        className="w-full rounded-lg border bg-background py-1.5 pl-5 pr-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEliminar(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
