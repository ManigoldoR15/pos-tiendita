'use client'

import { useState, useMemo } from 'react'
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle, Search, X, AlertTriangle } from 'lucide-react'
import { STOCK_MINIMO } from '@/lib/constantes'
import { Button } from '@/components/ui/button'
import { formatMXN, textoCentavos } from '@/lib/dinero'
import { cn } from '@/lib/utils'
import { registrarVentaAction } from './actions'

type Producto = {
  id: string
  nombre: string
  precio_venta: number
  existencias: number
  categoria_id: string | null
}

type Categoria = { id: string; nombre: string }
type MetodoPago = { id: string; nombre: string }

type ItemCarrito = {
  productoId: string
  nombre: string
  precio: number
  cantidad: number
}

type Props = {
  productos: Producto[]
  categorias: Categoria[]
  metodosPago: MetodoPago[]
}

export default function PosClient({ productos, categorias, metodosPago }: Props) {
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [metodoPagoId, setMetodoPagoId] = useState(metodosPago[0]?.id ?? '')
  const [pagoRecibido, setPagoRecibido] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorVenta, setErrorVenta] = useState<string | null>(null)
  const [ventaExitosa, setVentaExitosa] = useState(false)

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (q) return productos.filter((p) => p.nombre.toLowerCase().includes(q))
    return categoriaActiva
      ? productos.filter((p) => p.categoria_id === categoriaActiva)
      : productos
  }, [productos, categoriaActiva, busqueda])

  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const pagoEnCentavos = textoCentavos(pagoRecibido)
  const cambio = pagoRecibido.trim() ? pagoEnCentavos - total : null

  const metodoPagoNombre = metodosPago.find((m) => m.id === metodoPagoId)?.nombre ?? ''
  const esEfectivo = metodoPagoNombre.toLowerCase().includes('efectivo')

  function agregarProducto(producto: Producto) {
    if (producto.existencias <= 0) return
    setCarrito((prev) => {
      const existe = prev.find((i) => i.productoId === producto.id)
      if (existe) {
        return prev.map((i) =>
          i.productoId === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        )
      }
      return [
        ...prev,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          precio: producto.precio_venta,
          cantidad: 1,
        },
      ]
    })
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito((prev) => {
      const item = prev.find((i) => i.productoId === productoId)
      if (!item) return prev
      const nueva = item.cantidad + delta
      if (nueva <= 0) return prev.filter((i) => i.productoId !== productoId)
      return prev.map((i) => (i.productoId === productoId ? { ...i, cantidad: nueva } : i))
    })
  }

  function abrirCobro() {
    setErrorVenta(null)
    setPagoRecibido('')
    setModalAbierto(true)
  }

  async function confirmarVenta() {
    setProcesando(true)
    setErrorVenta(null)
    const result = await registrarVentaAction({
      items: carrito.map((i) => ({ producto_id: i.productoId, cantidad: i.cantidad })),
      metodo_pago_id: metodoPagoId,
      pago_recibido: esEfectivo && pagoRecibido.trim() ? pagoEnCentavos : null,
    })
    setProcesando(false)
    if ('error' in result) {
      setErrorVenta(result.error)
    } else {
      setCarrito([])
      setModalAbierto(false)
      setPagoRecibido('')
      setVentaExitosa(true)
      setTimeout(() => setVentaExitosa(false), 4000)
    }
  }

  if (ventaExitosa) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <CheckCircle className="h-20 w-20 text-green-500" />
        <p className="text-2xl font-bold">¡Venta registrada!</p>
        <p className="text-muted-foreground">Inventario actualizado.</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-8rem)] gap-4">
      {/* ── Grilla de productos ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Búsqueda */}
        <div className="relative mb-3 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filtro categorías — oculto mientras se busca */}
        {categorias.length > 0 && !busqueda && (
          <div className="mb-4 flex shrink-0 flex-wrap gap-2">
            <button
              onClick={() => setCategoriaActiva(null)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                !categoriaActiva ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
              )}
            >
              Todos
            </button>
            {categorias.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoriaActiva(cat.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                  categoriaActiva === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent',
                )}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {productosFiltrados.length === 0 ? (
            <p className="mt-12 text-center text-muted-foreground">
              {busqueda
                ? `Sin resultados para "${busqueda}".`
                : categoriaActiva
                ? 'No hay productos en esta categoría.'
                : 'No hay productos activos.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {productosFiltrados.map((producto) => {
                const sinStock = producto.existencias <= 0
                const enCarrito = carrito.find((i) => i.productoId === producto.id)
                return (
                  <button
                    key={producto.id}
                    onClick={() => agregarProducto(producto)}
                    disabled={sinStock}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-xl border bg-card p-4 text-center shadow-sm transition-all',
                      sinStock
                        ? 'cursor-not-allowed opacity-40'
                        : 'cursor-pointer hover:border-primary hover:shadow-md active:scale-95',
                    )}
                  >
                    {enCarrito && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {enCarrito.cantidad}
                      </span>
                    )}
                    <p className="mb-2 line-clamp-2 text-sm font-semibold leading-tight">
                      {producto.nombre}
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {formatMXN(producto.precio_venta)}
                    </p>
                    {sinStock && (
                      <p className="mt-1 text-xs font-medium text-destructive">Agotado</p>
                    )}
                    {!sinStock && producto.existencias <= STOCK_MINIMO && (
                      <p className="mt-1 flex items-center gap-0.5 text-xs font-medium text-orange-600">
                        <AlertTriangle className="h-3 w-3" />
                        {producto.existencias} u.
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Carrito ── */}
      <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <ShoppingCart className="h-5 w-5" />
          <span className="font-semibold">Carrito</span>
          {carrito.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {carrito.reduce((s, i) => s + i.cantidad, 0)} items
            </span>
          )}
        </div>

        {carrito.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Toca un producto para agregarlo
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {carrito.map((item) => (
                <div key={item.productoId} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{item.nombre}</p>
                    <p className="text-xs text-muted-foreground">{formatMXN(item.precio)} c/u</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => cambiarCantidad(item.productoId, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border hover:bg-accent"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.cantidad}</span>
                    <button
                      onClick={() => cambiarCantidad(item.productoId, 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border hover:bg-accent"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="w-14 shrink-0 text-right text-sm font-semibold">
                    {formatMXN(item.precio * item.cantidad)}
                  </p>
                </div>
              ))}
            </div>

            <div className="shrink-0 space-y-3 border-t p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold text-primary">{formatMXN(total)}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCarrito([])}
                  className="flex-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Vaciar
                </Button>
                <Button size="sm" onClick={abrirCobro} className="flex-1">
                  Cobrar
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modal cobro ── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-5 rounded-2xl bg-background p-6 shadow-xl">
            <h2 className="text-xl font-bold">Cobrar venta</h2>

            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground">Total</span>
              <span className="text-2xl font-bold text-primary">{formatMXN(total)}</span>
            </div>

            {/* Método de pago */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Método de pago</p>
              <div className="grid grid-cols-2 gap-2">
                {metodosPago.map((mp) => (
                  <button
                    key={mp.id}
                    onClick={() => {
                      setMetodoPagoId(mp.id)
                      setPagoRecibido('')
                    }}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors',
                      metodoPagoId === mp.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-accent',
                    )}
                  >
                    {mp.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Recibido + cambio (solo efectivo) */}
            {esEfectivo && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Recibido (opcional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={pagoRecibido}
                    onChange={(e) => setPagoRecibido(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background py-3 pl-7 pr-3 text-base outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {cambio !== null && cambio >= 0 && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <span className="text-sm font-semibold text-green-700">
                      Cambio: {formatMXN(cambio)}
                    </span>
                  </div>
                )}
                {cambio !== null && cambio < 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <span className="text-sm font-semibold text-red-700">
                      Falta: {formatMXN(Math.abs(cambio))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {errorVenta && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorVenta}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => setModalAbierto(false)}
                className="flex-1"
                disabled={procesando}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarVenta}
                disabled={procesando || (cambio !== null && cambio < 0)}
                className="flex-1"
              >
                {procesando ? 'Guardando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
