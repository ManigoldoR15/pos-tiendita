'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Grid3x3, Trash2, Plus, Minus, CheckCircle, X, Printer, User, HandCoins, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMXN } from '@/lib/dinero'
import { cn } from '@/lib/utils'
import TicketImprimible, { imprimirTicket, type DatosTicket } from '@/components/ticket-imprimible'
import { registrarVentaAction, buscarClientesAction, crearClienteAction } from './actions'
import type { ClienteSugerido } from './actions'
import type { Producto, MetodoPago } from './pos-client'
import { esGranel, formatCantidad, stepCantidad, minCantidad } from '@/lib/unidades'

type Item = {
  productoId: string
  nombre: string
  precio: number
  cantidad: number
  fiado: boolean
  unidad: string
}

type Props = {
  productos: Producto[]
  metodosPago: MetodoPago[]
  negocioNombre: string
  onCambiarModo: () => void
}

const BILLETES = [50_00, 100_00, 200_00, 500_00]

export default function PosMostrador({ productos, metodosPago, negocioNombre, onCambiarModo }: Props) {
  const [ticket, setTicket] = useState<Item[]>([])
  const metodoEfectivoInicial = metodosPago.find((m) => m.nombre.toLowerCase().includes('efectivo')) ?? metodosPago[0]
  const [metodoPagoId, setMetodoPagoId] = useState(metodoEfectivoInicial?.id ?? '')
  const [pagoRecibido, setPagoRecibido] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorVenta, setErrorVenta] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [scanError, setScanError] = useState('')
  const [ultimaVenta, setUltimaVenta] = useState<DatosTicket | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Granel: popup de cantidad al escanear
  const [granelPendiente, setGranelPendiente] = useState<Producto | null>(null)
  const [granelCantidad, setGranelCantidad] = useState('')

  // Cliente / fiado
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

  const total = ticket.reduce((s, i) => s + Math.round(i.precio * i.cantidad), 0)
  const totalFiado = ticket.reduce((s, i) => s + (i.fiado ? Math.round(i.precio * i.cantidad) : 0), 0)
  const montoPagar = Math.max(0, total - totalFiado)
  const hayFiado = totalFiado > 0
  const pagoNum = Math.round(parseFloat(pagoRecibido) * 100) || 0
  const cambio = pagoNum >= montoPagar ? pagoNum - montoPagar : null

  const metodoPagoNombre = metodosPago.find((m) => m.id === metodoPagoId)?.nombre ?? ''
  const esEfectivo = metodoPagoNombre.toLowerCase().includes('efectivo')
  const metodoEfectivo = metodosPago.find((m) => m.nombre.toLowerCase().includes('efectivo')) ?? metodosPago[0]
  const metodoTarjeta =
    metodosPago.find((m) => m.nombre.toLowerCase().includes('tarjeta')) ??
    metodosPago.find((m) => m.id !== metodoEfectivo?.id) ??
    metodosPago[0]

  // Re-focus scanner input — but never steal focus from selects or other inputs
  useEffect(() => {
    const interval = setInterval(() => {
      if (procesando || exito) return
      const ae = document.activeElement
      if (ae === inputRef.current) return
      const tag = ae?.tagName ?? ''
      if (tag === 'SELECT' || tag === 'TEXTAREA') return
      if (tag === 'INPUT' && ae !== inputRef.current) return
      inputRef.current?.focus()
    }, 300)
    return () => clearInterval(interval)
  }, [procesando, exito])

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault()
        if (ticket.length > 0 && !procesando && !exito) cobrar()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        quitarUltima()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const agregarPorBarcode = useCallback((codigo: string) => {
    const prod = productos.find(
      (p) => p.codigo_barras && p.codigo_barras.trim() === codigo.trim() && p.existencias > 0,
    )
    if (!prod) {
      setScanError(`Código no encontrado: ${codigo}`)
      setTimeout(() => setScanError(''), 2500)
      return
    }
    setScanError('')
    if (esGranel(prod.unidad_medida)) {
      setGranelPendiente(prod)
      setGranelCantidad('')
      return
    }
    setTicket((prev) => {
      const idx = prev.findIndex((i) => i.productoId === prod.id)
      if (idx >= 0) {
        const next = [...prev]
        const item = next[idx]
        const max = prod.existencias
        if (item.cantidad >= max) {
          setScanError(`Sin stock suficiente para ${prod.nombre}`)
          setTimeout(() => setScanError(''), 2500)
          return prev
        }
        next[idx] = { ...item, cantidad: item.cantidad + 1 }
        return next
      }
      return [...prev, {
        productoId: prod.id,
        nombre: prod.nombre,
        precio: prod.precio_venta,
        cantidad: 1,
        fiado: false,
        unidad: prod.unidad_medida,
      }]
    })
  }, [productos])

  function confirmarGranel() {
    if (!granelPendiente) return
    const cantidad = parseFloat(granelCantidad)
    if (isNaN(cantidad) || cantidad <= 0) return
    setTicket((prev) => {
      const idx = prev.findIndex((i) => i.productoId === granelPendiente.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + cantidad }
        return next
      }
      return [...prev, {
        productoId: granelPendiente.id,
        nombre: granelPendiente.nombre,
        precio: granelPendiente.precio_venta,
        cantidad,
        fiado: false,
        unidad: granelPendiente.unidad_medida,
      }]
    })
    setGranelPendiente(null)
    setGranelCantidad('')
    inputRef.current?.focus()
  }

  function toggleFiadoItem(productoId: string) {
    setTicket((prev) =>
      prev.map((i) => (i.productoId === productoId ? { ...i, fiado: !i.fiado } : i)),
    )
  }

  function toggleFiarTodo() {
    setTicket((prev) => {
      const todoFiado = prev.length > 0 && prev.every((i) => i.fiado)
      return prev.map((i) => ({ ...i, fiado: !todoFiado }))
    })
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

  function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = scanInput.trim()
    if (val) agregarPorBarcode(val)
    setScanInput('')
    inputRef.current?.focus()
  }

  function cambiarCantidad(id: string, delta: number) {
    setTicket((prev) => {
      const updated = prev.map((i) => {
        if (i.productoId !== id) return i
        const nueva = i.cantidad + delta
        if (nueva <= 0) return { ...i, cantidad: 0 }
        if (delta > 0) {
          const prod = productos.find((p) => p.id === id)
          if (prod && nueva > prod.existencias) {
            setScanError(`Solo quedan ${prod.existencias} de ${prod.nombre}`)
            setTimeout(() => setScanError(''), 3000)
            return { ...i, cantidad: prod.existencias }
          }
        }
        return { ...i, cantidad: nueva }
      })
      return updated.filter((i) => i.cantidad > 0)
    })
  }

  function setCantidadDirecta(id: string, valor: number) {
    setTicket((prev) => {
      const item = prev.find((i) => i.productoId === id)
      if (!item) return prev
      const prod = productos.find((p) => p.id === id)
      const maxStock = prod ? Number(prod.existencias) : Infinity
      const nueva = esGranel(item.unidad)
        ? Math.min(maxStock, Math.max(minCantidad(item.unidad), valor || minCantidad(item.unidad)))
        : Math.min(maxStock, Math.max(1, Math.floor(valor) || 1))
      return prev.map((i) => (i.productoId === id ? { ...i, cantidad: nueva } : i))
    })
  }

  function quitarUltima() {
    setTicket((prev) => prev.slice(0, -1))
  }

  function setBillete(centavos: number) {
    setPagoRecibido((centavos / 100).toFixed(2))
    inputRef.current?.focus()
  }

  async function cobrar() {
    if (ticket.length === 0 || procesando) return
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

    const res = await registrarVentaAction({
      items: ticket.map((i) => ({ producto_id: i.productoId, cantidad: i.cantidad, es_fiado: i.fiado })),
      metodo_pago_id: metodoPagoId,
      pago_recibido: pagoNum > 0 ? pagoNum : null,
      descuento: 0,
      cliente_id: clienteSeleccionado?.id ?? null,
    })

    setProcesando(false)
    if ('error' in res) {
      setErrorVenta(res.error)
      return
    }

    setUltimaVenta({
      items: ticket.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, fiado: i.fiado, unidad: i.unidad })),
      total,
      metodoPagoNombre,
      cambio: cambio !== null && cambio > 0 ? cambio : null,
      fecha: new Date().toISOString(),
      totalFiado,
      clienteNombre: clienteSeleccionado?.nombre ?? null,
    })
    setExito(true)
    setTimeout(() => {
      setExito(false)
      setTicket([])
      setPagoRecibido('')
      setScanInput('')
      setClienteSeleccionado(null)
      inputRef.current?.focus()
    }, 5000)
  }

  if (exito) {
    return (
      <>
        <div className="flex h-[calc(100svh-8rem)] items-center justify-center">
          <div className="text-center">
            <CheckCircle className="mx-auto mb-4 h-20 w-20 text-emerald-500" />
            <p className="text-2xl font-bold text-emerald-600">¡Venta registrada!</p>
            {cambio !== null && cambio > 0 && (
              <p className="mt-2 text-xl font-semibold">Cambio: {formatMXN(cambio)}</p>
            )}
            {ultimaVenta && (
              <Button variant="outline" className="mt-4" onClick={imprimirTicket}>
                <Printer className="h-4 w-4" />
                Imprimir ticket
              </Button>
            )}
          </div>
        </div>
        {ultimaVenta && <TicketImprimible negocioNombre={negocioNombre} datos={ultimaVenta} />}
      </>
    )
  }

  return (
    <>
    {/* Modal granel */}
    {granelPendiente && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-xs space-y-4 rounded-2xl bg-background p-6 shadow-2xl">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">¿Cuánto vendes?</h2>
          </div>
          <p className="text-sm text-muted-foreground">{granelPendiente.nombre}</p>
          <div className="relative">
            <input
              autoFocus
              type="number"
              min={minCantidad(granelPendiente.unidad_medida)}
              step={stepCantidad(granelPendiente.unidad_medida)}
              placeholder="0"
              value={granelCantidad}
              onChange={(e) => setGranelCantidad(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmarGranel()}
              className="w-full rounded-lg border border-input bg-background px-3 py-3 pr-16 text-xl font-bold outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
              {granelPendiente.unidad_medida}
            </span>
          </div>
          {granelCantidad && parseFloat(granelCantidad) > 0 && (
            <p className="text-sm font-medium text-primary">
              Subtotal: {formatMXN(Math.round(granelPendiente.precio_venta * parseFloat(granelCantidad)))}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setGranelPendiente(null); inputRef.current?.focus() }}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!granelCantidad || parseFloat(granelCantidad) <= 0}
              onClick={confirmarGranel}
            >
              Agregar
            </Button>
          </div>
        </div>
      </div>
    )}
    <div className="flex flex-col gap-4 md:flex-row md:h-[calc(100svh-8rem)]">
      {/* ── Panel izquierdo: ticket ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 gap-3">
        {/* Header con toggle de modo */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex rounded-lg border p-0.5 bg-muted/40">
            <button
              onClick={onCambiarModo}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Grid3x3 className="h-3.5 w-3.5" />
              Táctil
            </button>
            <button
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-card shadow-sm text-foreground"
            >
              <span className="h-3.5 w-3.5 flex items-center justify-center">⊡</span>
              Mostrador
            </button>
          </div>
          <p className="hidden sm:block text-xs text-muted-foreground">
            Escanea un código de barras o escríbelo y presiona Enter
          </p>
        </div>

        {/* Scanner input */}
        <form onSubmit={handleScanSubmit} className="shrink-0">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Código de barras (Enter para agregar)"
              autoFocus
              autoComplete="off"
              className={cn(
                'w-full rounded-xl border bg-background px-4 py-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-ring',
                scanError && 'border-destructive ring-2 ring-destructive/20',
              )}
            />
          </div>
          {scanError && (
            <p className="mt-1 text-xs text-destructive">{scanError}</p>
          )}
        </form>

        {/* Ticket */}
        <div className="card-soft md:flex-1 md:overflow-y-auto">
          {ticket.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <p>Ticket vacío — escanea un producto</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-4 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-center w-28">Cantidad</th>
                  <th className="px-4 py-2 text-right">Subtotal</th>
                  <th className="px-2 py-2 text-center w-16">Fiar</th>
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {ticket.map((item) => (
                  <tr key={item.productoId}>
                    <td className="px-4 py-2.5 font-medium truncate max-w-[200px]">{item.nombre}</td>
                    <td className="px-3 py-2 text-center">
                      {!esGranel(item.unidad) ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => cambiarCantidad(item.productoId, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.cantidad}
                            onChange={(e) => setCantidadDirecta(item.productoId, parseInt(e.target.value, 10))}
                            onFocus={(e) => e.target.select()}
                            className="w-12 rounded-md border bg-background py-1 text-center font-mono font-bold outline-none focus:ring-2 focus:ring-ring"
                          />
                          <button
                            onClick={() => cambiarCantidad(item.productoId, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min={minCantidad(item.unidad)}
                            step={stepCantidad(item.unidad)}
                            value={item.cantidad}
                            onChange={(e) => setCantidadDirecta(item.productoId, parseFloat(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            className="w-16 rounded-md border bg-background py-1 text-center font-mono font-bold outline-none focus:ring-2 focus:ring-ring"
                          />
                          <span className="text-xs text-muted-foreground">{item.unidad}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {formatMXN(Math.round(item.precio * item.cantidad))}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={item.fiado}
                        onChange={() => toggleFiadoItem(item.productoId)}
                        className="h-4 w-4 rounded accent-primary"
                        title="Fiar este producto"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => setTicket((p) => p.filter((i) => i.productoId !== item.productoId))}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Atajos de teclado */}
        <div className="flex flex-wrap gap-2 shrink-0 text-xs text-muted-foreground">
          <span className="rounded border px-1.5 py-0.5 font-mono bg-muted">F2</span> Cobrar
          <span className="ml-2 rounded border px-1.5 py-0.5 font-mono bg-muted">Esc</span> Quitar último
        </div>
      </div>

      {/* ── Panel derecho: cobro ────────────────────────────────────────── */}
      <div className="flex w-full flex-col gap-3 md:w-72 md:shrink-0">
        {/* Total */}
        <div className={cn(
          'card-soft p-6 text-center',
          ticket.length > 0 ? 'bg-primary text-primary-foreground' : '',
        )}>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Total</p>
          <p className="text-5xl font-black tracking-tight tabular-nums leading-none">
            {ticket.length > 0 ? formatMXN(total) : '$0.00'}
          </p>
          <p className="mt-1 text-xs opacity-60">{ticket.reduce((s, i) => s + i.cantidad, 0)} artículo(s)</p>
          {hayFiado && (
            <div className="mt-2 space-y-0.5 border-t border-white/20 pt-2 text-sm">
              <p className="opacity-80">Queda a deber: {formatMXN(totalFiado)}</p>
              <p className="font-bold">A pagar ahora: {formatMXN(montoPagar)}</p>
            </div>
          )}
        </div>

        {/* Cliente (requerido si hay fiado) */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Cliente {hayFiado ? '(requerido para fiar)' : '(opcional)'}</p>
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
              En lista negra: {clienteSeleccionado.motivo_lista_negra ?? 'sin motivo especificado'}. No se le puede fiar.
            </p>
          )}
          {!clienteSeleccionado && (creandoCliente ? (
            <div className="space-y-1.5">
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
              {errorCliente && <p className="text-xs text-destructive">{errorCliente}</p>}
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
                      {c.telefono && <span className="text-xs text-muted-foreground">{c.telefono}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Fiar venta completa */}
        <button
          type="button"
          onClick={toggleFiarTodo}
          disabled={(clienteSeleccionado?.en_lista_negra ?? false) || ticket.length === 0}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-center text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            ticket.length > 0 && ticket.every((i) => i.fiado)
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-amber-300 text-amber-600 hover:bg-amber-50',
          )}
        >
          <HandCoins className="h-4 w-4" />
          Fiar venta completa
        </button>

        {/* Método de pago */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMetodoPagoId(metodoEfectivo?.id ?? '')}
            className={cn(
              'rounded-xl border-2 py-3 text-center text-sm font-bold transition-colors',
              esEfectivo ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
            )}
          >
            Efectivo
          </button>
          <button
            type="button"
            onClick={() => setMetodoPagoId(metodoTarjeta?.id ?? '')}
            className={cn(
              'rounded-xl border-2 py-3 text-center text-sm font-bold transition-colors',
              !esEfectivo ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
            )}
          >
            Tarjeta
          </button>
        </div>

        {/* Dinero recibido */}
        {montoPagar > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Dinero recibido</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pagoRecibido}
              onChange={(e) => setPagoRecibido(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border bg-background py-2.5 pl-7 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
              onFocus={(e) => e.target.select()}
            />
          </div>
        </div>
        )}

        {/* Billetes rápidos */}
        {montoPagar > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {BILLETES.map((b) => (
            <button
              key={b}
              onClick={() => setBillete(b)}
              className={cn(
                'rounded-lg border py-2 text-xs font-bold transition-colors hover:bg-primary hover:text-primary-foreground',
                pagoNum === b && 'bg-primary text-primary-foreground',
              )}
            >
              ${b / 100}
            </button>
          ))}
        </div>
        )}

        {/* Cambio */}
        {montoPagar > 0 && cambio !== null && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-center">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Cambio</p>
            <p className="text-2xl font-black tracking-tight text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatMXN(cambio)}
            </p>
          </div>
        )}

        {/* Error */}
        {errorVenta && (
          <p className="text-sm text-destructive text-center">{errorVenta}</p>
        )}

        {/* Botón cobrar */}
        <Button
          size="lg"
          className="h-14 text-lg font-bold w-full"
          disabled={ticket.length === 0 || procesando}
          onClick={cobrar}
        >
          {procesando ? 'Procesando…' : `F2 · Cobrar ${ticket.length > 0 ? formatMXN(total) : ''}`}
        </Button>

        {/* Vaciar ticket */}
        {ticket.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setTicket([])}
          >
            <Trash2 className="h-4 w-4" />
            Vaciar ticket
          </Button>
        )}
      </div>
    </div>
    </>
  )
}
