'use client'

import { useActionState, useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Trash2, ShoppingBag } from 'lucide-react'
import { registrarCompraAction } from '@/app/actions/compras'
import { formatMXN, textoCentavos, centavosATexto } from '@/lib/dinero'
import { cn } from '@/lib/utils'

type Producto = {
  id: string
  nombre: string
  precio_costo: number | null
  unidad_medida: string
}

type Proveedor = {
  id: string
  nombre: string
}

type LineaCompra = {
  producto: Producto
  cantidad: number
  costo_unitario: number
}

export default function CompraForm({
  productos,
  proveedores,
  hoy,
}: {
  productos: Producto[]
  proveedores: Proveedor[]
  hoy: string
}) {
  const [error, action, pending] = useActionState(registrarCompraAction, null)
  const router = useRouter()

  const [lineas, setLineas] = useState<LineaCompra[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [sugerencias, setSugerencias] = useState<Producto[]>([])
  const [showSug, setShowSug] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sugRef = useRef<HTMLDivElement>(null)

  const total = lineas.reduce((s, l) => s + Math.round(l.cantidad * l.costo_unitario), 0)

  useEffect(() => {
    if (busqueda.trim().length < 1) {
      setSugerencias([])
      return
    }
    const q = busqueda.toLowerCase()
    const ids = new Set(lineas.map((l) => l.producto.id))
    setSugerencias(
      productos
        .filter((p) => p.nombre.toLowerCase().includes(q) && !ids.has(p.id))
        .slice(0, 8),
    )
  }, [busqueda, productos, lineas])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        sugRef.current &&
        !sugRef.current.contains(e.target as Node) &&
        inputRef.current !== e.target
      ) {
        setShowSug(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const agregarProducto = useCallback(
    (p: Producto) => {
      setLineas((prev) => [
        ...prev,
        {
          producto: p,
          cantidad: 1,
          costo_unitario: p.precio_costo ?? 0,
        },
      ])
      setBusqueda('')
      setSugerencias([])
      setShowSug(false)
      inputRef.current?.focus()
    },
    [],
  )

  const actualizarLinea = (idx: number, campo: 'cantidad' | 'costo_unitario', valor: string) => {
    setLineas((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l
        if (campo === 'cantidad') {
          const n = parseFloat(valor.replace(',', '.'))
          return { ...l, cantidad: isNaN(n) || n < 0 ? l.cantidad : n }
        }
        return { ...l, costo_unitario: textoCentavos(valor) }
      }),
    )
  }

  const quitarLinea = (idx: number) => {
    setLineas((prev) => prev.filter((_, i) => i !== idx))
  }

  const itemsPayload = JSON.stringify(
    lineas.map((l) => ({
      producto_id: l.producto.id,
      cantidad: l.cantidad,
      costo_unitario: l.costo_unitario,
    })),
  )

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="items" value={itemsPayload} />

      {/* Proveedor + fecha + notas */}
      <div className="card-soft p-5 space-y-4">
        <h2 className="font-semibold">Datos de la entrada</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Proveedor (opcional)</label>
            <select
              name="proveedor_id"
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— Sin proveedor —</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fecha</label>
            <input
              type="date"
              name="fecha"
              defaultValue={hoy}
              max={hoy}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notas (opcional)</label>
          <textarea
            name="notas"
            rows={2}
            placeholder="Factura #123, observaciones…"
            className="w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Buscador de productos */}
      <div className="card-soft p-5 space-y-4">
        <h2 className="font-semibold">Productos recibidos</h2>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setShowSug(true)
            }}
            onFocus={() => busqueda.length > 0 && setShowSug(true)}
            placeholder="Buscar producto para agregar…"
            className="w-full rounded-xl border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {showSug && sugerencias.length > 0 && (
            <div
              ref={sugRef}
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border bg-card shadow-lg"
            >
              {sugerencias.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregarProducto(p)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="flex-1">{p.nombre}</span>
                  <span className="text-xs text-muted-foreground">{p.unidad_medida}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabla de líneas */}
        {lineas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Busca productos para agregarlos.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="hidden grid-cols-[1fr_120px_130px_80px_32px] gap-3 px-2 text-xs font-medium text-muted-foreground sm:grid">
              <span>Producto</span>
              <span>Cantidad</span>
              <span>Costo unitario</span>
              <span className="text-right">Subtotal</span>
              <span />
            </div>

            {lineas.map((l, idx) => {
              const subtotal = Math.round(l.cantidad * l.costo_unitario)
              return (
                <div
                  key={l.producto.id}
                  className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border bg-background p-3 sm:grid-cols-[1fr_120px_130px_80px_32px] sm:items-center sm:gap-3 sm:p-2 sm:px-2"
                >
                  {/* Nombre */}
                  <div className="min-w-0 sm:col-span-1">
                    <p className="truncate text-sm font-medium">{l.producto.nombre}</p>
                    <p className="text-xs text-muted-foreground">{l.producto.unidad_medida}</p>
                  </div>

                  {/* Eliminar (mobile: top-right) */}
                  <button
                    type="button"
                    onClick={() => quitarLinea(idx)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive sm:hidden"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  {/* Cantidad */}
                  <div className="flex items-center gap-1.5 sm:col-start-2">
                    <label className="text-xs text-muted-foreground sm:hidden">Cant:</label>
                    <input
                      type="number"
                      min="0.001"
                      step={l.producto.unidad_medida === 'pieza' ? '1' : '0.001'}
                      value={l.cantidad}
                      onChange={(e) => actualizarLinea(idx, 'cantidad', e.target.value)}
                      className="w-full rounded-lg border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Costo unitario */}
                  <div className="flex items-center gap-1.5 sm:col-start-3">
                    <label className="text-xs text-muted-foreground sm:hidden">Costo:</label>
                    <div className="relative w-full">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={centavosATexto(l.costo_unitario)}
                        onBlur={(e) => actualizarLinea(idx, 'costo_unitario', e.target.value)}
                        className="w-full rounded-lg border bg-background py-1 pl-5 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Subtotal */}
                  <div className="text-right text-sm font-semibold sm:col-start-4">
                    {formatMXN(subtotal)}
                  </div>

                  {/* Eliminar desktop */}
                  <button
                    type="button"
                    onClick={() => quitarLinea(idx)}
                    className="hidden h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive sm:flex sm:col-start-5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}

            {/* Total */}
            <div className="flex justify-end border-t pt-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total de la entrada</p>
                <p className="text-2xl font-black tracking-tight text-primary">{formatMXN(total)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Botón */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || lineas.length === 0}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition',
            lineas.length === 0
              ? 'bg-primary/40 cursor-not-allowed'
              : 'bg-primary hover:opacity-90',
          )}
        >
          {pending ? 'Registrando…' : `Registrar entrada (${formatMXN(total)})`}
        </button>
      </div>
    </form>
  )
}
