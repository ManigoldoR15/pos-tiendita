'use client'

import { useState, useMemo, useEffect } from 'react'
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle, Search, X, AlertTriangle, User, Monitor, Grid3x3, Printer, HandCoins } from 'lucide-react'
import { STOCK_MINIMO } from '@/lib/constantes'
import { Button } from '@/components/ui/button'
import { formatMXN, textoCentavos } from '@/lib/dinero'
import { cn } from '@/lib/utils'
import { getColorCategoria } from '@/lib/colores-categoria'
import TicketImprimible, { imprimirTicket, type DatosTicket } from '@/components/ticket-imprimible'
import { registrarVentaAction, buscarClientesAction, crearClienteAction } from './actions'
import type { ClienteSugerido } from './actions'
import PosMostrador from './pos-mostrador'

export type Producto = {
  id: string
  nombre: string
  precio_venta: number
  existencias: number
  categoria_id: string | null
  codigo_barras: string | null
}

type Categoria = { id: string; nombre: string; color: string | null }
export type MetodoPago = { id: string; nombre: string }

type ItemCarrito = {
  productoId: string
  nombre: string
  precio: number
  cantidad: number
  fiado: boolean
}

type Props = {
  productos: Producto[]
  categorias: Categoria[]
  metodosPago: MetodoPago[]
  negocioNombre: string
}

export default function PosClient({ productos, categorias, metodosPago, negocioNombre }: Props) {
  const [modo, setModo] = useState<'tactil' | 'mostrador'>('tactil')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [metodoPagoId, setMetodoPagoId] = useState(metodosPago[0]?.id ?? '')
  const [pagoRecibido, setPagoRecibido] = useState('')
  const [descuentoTipo, setDescuentoTipo] = useState<'pct' | 'mxn'>('pct')
  const [descuentoValor, setDescuentoValor] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorVenta, setErrorVenta] = useState<string | null>(null)
  const [ventaExitosa, setVentaExitosa] = useState(false)
  const [ultimaVenta, setUltimaVenta] = useState<DatosTicket | null>(null)

  // Fase 16: clientes frecuentes
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteSugerido | null>(null)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [sugerenciasCliente, setSugerenciasCliente] = useState<ClienteSugerido[]>([])
  const [creandoCliente, setCreandoCliente] = useState(false)
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('')
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState('')
  const [guardandoCliente, setGuardandoCliente] = useState(false)
  const [errorCliente, setErrorCliente] = useState<string | null>(null)

  useEffect(() => {
    if (busquedaCliente.trim().length < 2) {
      setSugerenciasCliente([])
      return
    }
    const timer = setTimeout(async () => {
      const results = await buscarClientesAction(busquedaCliente)
      setSugerenciasCliente(results)
    }, 300)
    return () => clearTimeout(timer)
  }, [busquedaCliente])

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (q) return productos.filter((p) => p.nombre.toLowerCase().includes(q))
    return categoriaActiva
      ? productos.filter((p) => p.categoria_id === categoriaActiva)
      : productos
  }, [productos, categoriaActiva, busqueda])

  const subtotal = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0)

  const descuentoCentavos = useMemo(() => {
    const v = parseFloat(descuentoValor)
    if (!descuentoValor.trim() || isNaN(v) || v <= 0) return 0
    if (descuentoTipo === 'pct') return Math.min(subtotal, Math.round(subtotal * v / 100))
    return Math.min(subtotal, Math.round(v * 100))
  }, [descuentoValor, descuentoTipo, subtotal])

  const total = Math.max(0, subtotal - descuentoCentavos)
  const totalFiado = carrito.reduce((s, i) => s + (i.fiado ? i.precio * i.cantidad : 0), 0)
  const montoPagar = Math.max(0, total - totalFiado)
  const hayFiado = totalFiado > 0
  const pagoEnCentavos = textoCentavos(pagoRecibido)
  const cambio = pagoRecibido.trim() ? pagoEnCentavos - montoPagar : null

  const metodoPagoNombre = metodosPago.find((m) => m.id === metodoPagoId)?.nombre ?? ''
  const esEfectivo = metodoPagoNombre.toLowerCase().includes('efectivo')

  const metodoEfectivo = metodosPago.find((m) => m.nombre.toLowerCase().includes('efectivo')) ?? metodosPago[0]
  const metodoTarjeta =
    metodosPago.find((m) => m.nombre.toLowerCase().includes('tarjeta')) ??
    metodosPago.find((m) => m.id !== metodoEfectivo?.id) ??
    metodosPago[0]

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
          fiado: false,
        },
      ]
    })
  }

  function toggleFiadoItem(productoId: string) {
    setCarrito((prev) =>
      prev.map((i) => (i.productoId === productoId ? { ...i, fiado: !i.fiado } : i)),
    )
  }

  function toggleFiarTodo() {
    setCarrito((prev) => {
      const todoFiado = prev.length > 0 && prev.every((i) => i.fiado)
      return prev.map((i) => ({ ...i, fiado: !todoFiado }))
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

  function setCantidadDirecta(productoId: string, valor: number) {
    const nueva = Math.max(1, Math.floor(valor) || 1)
    setCarrito((prev) =>
      prev.map((i) => (i.productoId === productoId ? { ...i, cantidad: nueva } : i)),
    )
  }

  function abrirCobro() {
    setErrorVenta(null)
    setPagoRecibido('')
    setDescuentoValor('')
    setClienteSeleccionado(null)
    setBusquedaCliente('')
    setSugerenciasCliente([])
    setCreandoCliente(false)
    setNuevoClienteNombre('')
    setNuevoClienteTelefono('')
    setErrorCliente(null)
    setModalAbierto(true)
  }

  function cancelarCrearCliente() {
    setCreandoCliente(false)
    setNuevoClienteNombre('')
    setNuevoClienteTelefono('')
    setErrorCliente(null)
  }

  async function handleCrearCliente() {
    if (!nuevoClienteNombre.trim()) return
    setGuardandoCliente(true)
    setErrorCliente(null)
    const result = await crearClienteAction(nuevoClienteNombre, nuevoClienteTelefono || undefined)
    setGuardandoCliente(false)
    if ('error' in result) {
      setErrorCliente(result.error)
      return
    }
    setClienteSeleccionado(result)
    setCreandoCliente(false)
    setNuevoClienteNombre('')
    setNuevoClienteTelefono('')
    setBusquedaCliente('')
  }

  async function confirmarVenta() {
    setErrorVenta(null)

    if (hayFiado && !clienteSeleccionado) {
      setErrorVenta('Selecciona o crea un cliente para fiar.')
      return
    }
    if (hayFiado && clienteSeleccionado?.en_lista_negra) {
      setErrorVenta(
        `Este cliente está en lista negra: ${clienteSeleccionado.motivo_lista_negra ?? 'sin motivo especificado'}`,
      )
      return
    }

    setProcesando(true)
    const result = await registrarVentaAction({
      items: carrito.map((i) => ({ producto_id: i.productoId, cantidad: i.cantidad, es_fiado: i.fiado })),
      metodo_pago_id: metodoPagoId,
      pago_recibido: esEfectivo && pagoRecibido.trim() ? pagoEnCentavos : null,
      descuento: descuentoCentavos,
      cliente_id: clienteSeleccionado?.id ?? null,
    })
    setProcesando(false)
    if ('error' in result) {
      setErrorVenta(result.error)
    } else {
      setUltimaVenta({
        items: carrito.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, fiado: i.fiado })),
        total,
        metodoPagoNombre,
        cambio: esEfectivo && cambio !== null && cambio > 0 ? cambio : null,
        fecha: new Date().toISOString(),
        totalFiado,
        clienteNombre: clienteSeleccionado?.nombre ?? null,
      })
      setCarrito([])
      setModalAbierto(false)
      setPagoRecibido('')
      setClienteSeleccionado(null)
      setVentaExitosa(true)
      setTimeout(() => setVentaExitosa(false), 8000)
    }
  }

  if (ventaExitosa) {
    return (
      <>
        <div className="flex h-96 flex-col items-center justify-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="h-12 w-12 text-primary" />
          </div>
          <p className="text-2xl font-bold">¡Venta registrada!</p>
          <p className="text-muted-foreground">Inventario actualizado.</p>
          {ultimaVenta && (
            <Button variant="outline" onClick={imprimirTicket}>
              <Printer className="h-4 w-4" />
              Imprimir ticket
            </Button>
          )}
          <p className="text-sm text-muted-foreground">Listo para la siguiente venta.</p>
        </div>
        {ultimaVenta && <TicketImprimible negocioNombre={negocioNombre} datos={ultimaVenta} />}
      </>
    )
  }

  // Modo mostrador — renderiza componente dedicado
  if (modo === 'mostrador') {
    return (
      <PosMostrador
        productos={productos}
        metodosPago={metodosPago}
        negocioNombre={negocioNombre}
        onCambiarModo={() => setModo('tactil')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:h-[calc(100svh-8rem)]">
      {/* ── Grilla de productos ── */}
      <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden">
        {/* Toggle de modo */}
        <div className="mb-3 flex items-center gap-2 shrink-0">
          <div className="flex rounded-lg border p-0.5 bg-muted/40">
            <button
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-card shadow-sm text-foreground"
            >
              <Grid3x3 className="h-3.5 w-3.5" />
              Táctil
            </button>
            <button
              onClick={() => setModo('mostrador')}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Monitor className="h-3.5 w-3.5" />
              Mostrador
            </button>
          </div>
        </div>

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

        <div className="md:flex-1 md:overflow-y-auto">
          {productosFiltrados.length === 0 ? (
            <p className="mt-12 text-center text-muted-foreground">
              {busqueda
                ? `Sin resultados para "${busqueda}".`
                : categoriaActiva
                ? 'No hay productos en esta categoría.'
                : 'No hay productos activos.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {productosFiltrados.map((producto) => {
                const sinStock = producto.existencias <= 0
                const enCarrito = carrito.find((i) => i.productoId === producto.id)
                const categoria = categorias.find((c) => c.id === producto.categoria_id)
                const colorCat = getColorCategoria(categoria?.color)
                return (
                  <button
                    key={producto.id}
                    onClick={() => agregarProducto(producto)}
                    disabled={sinStock}
                    className={cn(
                      'card-soft relative flex flex-col items-center justify-center overflow-hidden p-5 text-center transition-all duration-150',
                      sinStock
                        ? 'cursor-not-allowed opacity-40'
                        : 'cursor-pointer hover:ring-2 hover:ring-primary/30 active:scale-[0.97]',
                      enCarrito && !sinStock && 'ring-2 ring-primary/40 bg-primary/[0.04]',
                    )}
                  >
                    {colorCat && (
                      <span className={cn('absolute inset-x-0 top-0 h-1.5', colorCat.bar)} />
                    )}
                    {enCarrito && (
                      <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                        {enCarrito.cantidad}
                      </span>
                    )}
                    {colorCat && (
                      <span className={cn('absolute left-2.5 top-2.5 h-2.5 w-2.5 rounded-full', colorCat.dot)} />
                    )}
                    <p className="mb-2.5 line-clamp-2 text-sm font-semibold leading-tight">
                      {producto.nombre}
                    </p>
                    <p className="text-2xl font-black tracking-tight text-primary">
                      {formatMXN(producto.precio_venta)}
                    </p>
                    {sinStock && (
                      <p className="mt-1.5 text-xs font-medium text-destructive">Agotado</p>
                    )}
                    {!sinStock && producto.existencias <= STOCK_MINIMO && (
                      <p className="mt-1.5 flex items-center gap-0.5 text-xs font-medium text-orange-500">
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
      <div className="card-soft flex w-full flex-col md:w-80 md:shrink-0 md:overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-b px-5 py-4">
          <ShoppingCart className="h-5 w-5 text-muted-foreground" />
          <span className="font-bold">Carrito</span>
          {carrito.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {carrito.reduce((s, i) => s + i.cantidad, 0)} items
            </span>
          )}
        </div>

        {carrito.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Toca un producto para agregarlo</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 md:flex-1 md:overflow-y-auto">
              {carrito.map((item) => (
                <div key={item.productoId} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">{item.nombre}</p>
                      <p className="text-xs text-muted-foreground">{formatMXN(item.precio)} c/u</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => cambiarCantidad(item.productoId, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border hover:bg-accent"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => setCantidadDirecta(item.productoId, parseInt(e.target.value, 10))}
                        onFocus={(e) => e.target.select()}
                        className="w-12 rounded-md border bg-background py-1 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        onClick={() => cambiarCantidad(item.productoId, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border hover:bg-accent"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="w-14 shrink-0 text-right text-sm font-semibold">
                      {formatMXN(item.precio * item.cantidad)}
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 pl-0.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={item.fiado}
                      onChange={() => toggleFiadoItem(item.productoId)}
                      className="h-3.5 w-3.5 rounded accent-primary"
                    />
                    Fiar este producto
                  </label>
                </div>
              ))}
            </div>

            <div className="shrink-0 space-y-3 border-t p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total</span>
                <span className="text-3xl font-black tracking-tight text-primary">{formatMXN(total)}</span>
              </div>
              <Button
                onClick={abrirCobro}
                className="w-full h-14 text-lg font-bold"
              >
                Cobrar {formatMXN(total)}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCarrito([])}
                className="w-full text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-1.5" />
                Vaciar carrito
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ── Modal cobro ── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-6 overflow-y-auto rounded-3xl bg-background p-7 shadow-2xl" style={{ maxHeight: 'calc(100svh - 2rem)' }}>
            <h2 className="text-2xl font-black tracking-tight">Cobrar venta</h2>

            {/* Totales */}
            <div className="space-y-1.5 border-b pb-4">
              {descuentoCentavos > 0 && (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatMXN(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Descuento</span>
                    <span>−{formatMXN(descuentoCentavos)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-3xl font-black tracking-tight text-primary">{formatMXN(total)}</span>
              </div>
              {hayFiado && (
                <>
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Queda a deber</span>
                    <span>−{formatMXN(totalFiado)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-1.5">
                    <span className="text-sm font-medium text-muted-foreground">A pagar ahora</span>
                    <span className="text-xl font-bold">{formatMXN(montoPagar)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Descuento */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Descuento (opcional)</p>
              <div className="flex gap-2">
                <div className="flex shrink-0 overflow-hidden rounded-lg border">
                  <button
                    type="button"
                    onClick={() => { setDescuentoTipo('pct'); setDescuentoValor('') }}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium transition-colors',
                      descuentoTipo === 'pct' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                    )}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDescuentoTipo('mxn'); setDescuentoValor('') }}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium transition-colors',
                      descuentoTipo === 'mxn' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                    )}
                  >
                    $
                  </button>
                </div>
                <div className="relative flex-1">
                  {descuentoTipo === 'mxn' && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  )}
                  <input
                    type="number"
                    min="0"
                    max={descuentoTipo === 'pct' ? 100 : undefined}
                    step={descuentoTipo === 'pct' ? 1 : 0.01}
                    placeholder={descuentoTipo === 'pct' ? '0' : '0.00'}
                    value={descuentoValor}
                    onChange={(e) => setDescuentoValor(e.target.value)}
                    className={cn(
                      'w-full rounded-lg border border-input bg-background py-2 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring',
                      descuentoTipo === 'mxn' ? 'pl-7' : 'pl-3',
                    )}
                  />
                  {descuentoTipo === 'pct' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  )}
                </div>
              </div>
            </div>

            {/* Cliente (opcional) — Fase 16 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Cliente (opcional)</p>

              {clienteSeleccionado ? (
                <div className="flex items-center justify-between rounded-lg border bg-accent px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{clienteSeleccionado.nombre}</p>
                    {clienteSeleccionado.telefono && (
                      <p className="text-xs text-muted-foreground">{clienteSeleccionado.telefono}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setClienteSeleccionado(null)}
                    className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {clienteSeleccionado?.en_lista_negra && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  Este cliente está en lista negra: {clienteSeleccionado.motivo_lista_negra ?? 'sin motivo especificado'}. No se le puede fiar (sí se le puede vender de contado).
                </p>
              )}
              {!clienteSeleccionado && (creandoCliente ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    placeholder="Nombre *"
                    value={nuevoClienteNombre}
                    onChange={(e) => setNuevoClienteNombre(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCrearCliente()}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    placeholder="Teléfono (opcional)"
                    value={nuevoClienteTelefono}
                    onChange={(e) => setNuevoClienteTelefono(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCrearCliente()}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  {errorCliente && (
                    <p className="text-xs text-destructive">{errorCliente}</p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={cancelarCrearCliente}>
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={!nuevoClienteNombre.trim() || guardandoCliente}
                      onClick={handleCrearCliente}
                    >
                      {guardandoCliente ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    placeholder="Buscar nombre o teléfono…"
                    value={busquedaCliente}
                    onChange={(e) => setBusquedaCliente(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-20 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => { setCreandoCliente(true); setNuevoClienteNombre(busquedaCliente.trim()) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-accent px-2 py-0.5 text-xs font-medium hover:bg-accent/80"
                  >
                    + Nuevo
                  </button>
                  {sugerenciasCliente.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border bg-background shadow-lg">
                      {sugerenciasCliente.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setClienteSeleccionado(c)
                            setBusquedaCliente('')
                            setSugerenciasCliente([])
                          }}
                          className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-accent"
                        >
                          <span className="text-sm font-medium">{c.nombre}</span>
                          {c.telefono && (
                            <span className="text-xs text-muted-foreground">{c.telefono}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {busquedaCliente.trim().length >= 2 && sugerenciasCliente.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sin resultados.{' '}
                      <button
                        type="button"
                        className="text-primary underline underline-offset-2"
                        onClick={() => { setCreandoCliente(true); setNuevoClienteNombre(busquedaCliente.trim()) }}
                      >
                        Crear cliente
                      </button>
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Método de pago */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Método de pago</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMetodoPagoId(metodoEfectivo?.id ?? '')
                    setPagoRecibido('')
                  }}
                  className={cn(
                    'rounded-xl border-2 px-4 py-4 text-center text-base font-bold transition-colors',
                    esEfectivo
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'hover:bg-accent',
                  )}
                >
                  Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMetodoPagoId(metodoTarjeta?.id ?? '')
                    setPagoRecibido('')
                  }}
                  className={cn(
                    'rounded-xl border-2 px-4 py-4 text-center text-base font-bold transition-colors',
                    !esEfectivo
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'hover:bg-accent',
                  )}
                >
                  Tarjeta
                </button>
              </div>
              <button
                type="button"
                onClick={toggleFiarTodo}
                disabled={clienteSeleccionado?.en_lista_negra ?? false}
                className={cn(
                  'flex w-full items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-3 text-center text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  carrito.length > 0 && carrito.every((i) => i.fiado)
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-amber-300 text-amber-600 hover:bg-amber-50',
                )}
              >
                <HandCoins className="h-4 w-4" />
                Fiar venta completa
              </button>
            </div>

            {/* Recibido + cambio (solo efectivo, y solo si queda algo por cobrar) */}
            {esEfectivo && montoPagar > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Dinero recibido (opcional)</label>
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
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20 px-4 py-3">
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Cambio</p>
                    <p className="text-xl font-black tracking-tight text-emerald-700 dark:text-emerald-300">
                      {formatMXN(cambio)}
                    </p>
                  </div>
                )}
                {cambio !== null && cambio < 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/20 px-4 py-3">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">Falta</p>
                    <p className="text-xl font-black tracking-tight text-red-700 dark:text-red-300">
                      {formatMXN(Math.abs(cambio))}
                    </p>
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
                className="flex-1 h-12"
                disabled={procesando}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarVenta}
                disabled={procesando || (cambio !== null && cambio < 0)}
                className="flex-1 h-12 text-base font-bold"
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
