'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Grid3x3, Trash2, Plus, Minus, CheckCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMXN } from '@/lib/dinero'
import { cn } from '@/lib/utils'
import { registrarVentaAction } from './actions'
import type { Producto, MetodoPago } from './pos-client'

type Item = {
  productoId: string
  nombre: string
  precio: number
  cantidad: number
}

type Props = {
  productos: Producto[]
  metodosPago: MetodoPago[]
  onCambiarModo: () => void
}

const BILLETES = [50_00, 100_00, 200_00, 500_00]

export default function PosMostrador({ productos, metodosPago, onCambiarModo }: Props) {
  const [ticket, setTicket] = useState<Item[]>([])
  const [metodoPagoId, setMetodoPagoId] = useState(metodosPago[0]?.id ?? '')
  const [pagoRecibido, setPagoRecibido] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorVenta, setErrorVenta] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [scanError, setScanError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const total = ticket.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const pagoNum = Math.round(parseFloat(pagoRecibido) * 100) || 0
  const cambio = pagoNum >= total ? pagoNum - total : null

  // Re-focus scanner input constantly
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.activeElement !== inputRef.current && !procesando && !exito) {
        inputRef.current?.focus()
      }
    }, 300)
    return () => clearInterval(interval)
  }, [procesando, exito])

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault()
        if (ticket.length > 0 && !procesando) cobrar()
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
      }]
    })
  }, [productos])

  function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = scanInput.trim()
    if (val) agregarPorBarcode(val)
    setScanInput('')
    inputRef.current?.focus()
  }

  function cambiarCantidad(id: string, delta: number) {
    setTicket((prev) =>
      prev
        .map((i) => i.productoId === id ? { ...i, cantidad: i.cantidad + delta } : i)
        .filter((i) => i.cantidad > 0),
    )
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
    setProcesando(true)
    setErrorVenta(null)

    const res = await registrarVentaAction({
      items: ticket.map((i) => ({ producto_id: i.productoId, cantidad: i.cantidad })),
      metodo_pago_id: metodoPagoId,
      pago_recibido: pagoNum > 0 ? pagoNum : null,
      descuento: 0,
    })

    setProcesando(false)
    if ('error' in res) {
      setErrorVenta(res.error)
      return
    }

    setExito(true)
    setTimeout(() => {
      setExito(false)
      setTicket([])
      setPagoRecibido('')
      setScanInput('')
      inputRef.current?.focus()
    }, 2000)
  }

  if (exito) {
    return (
      <div className="flex h-[calc(100svh-8rem)] items-center justify-center">
        <div className="text-center">
          <CheckCircle className="mx-auto mb-4 h-20 w-20 text-emerald-500" />
          <p className="text-2xl font-bold text-emerald-600">¡Venta registrada!</p>
          {cambio !== null && cambio > 0 && (
            <p className="mt-2 text-xl font-semibold">Cambio: {formatMXN(cambio)}</p>
          )}
        </div>
      </div>
    )
  }

  return (
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
        <div className="md:flex-1 md:overflow-y-auto rounded-xl border bg-card">
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
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {ticket.map((item) => (
                  <tr key={item.productoId}>
                    <td className="px-4 py-2.5 font-medium truncate max-w-[200px]">{item.nombre}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => cambiarCantidad(item.productoId, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center font-mono font-bold">{item.cantidad}</span>
                        <button
                          onClick={() => cambiarCantidad(item.productoId, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {formatMXN(item.precio * item.cantidad)}
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
          'rounded-xl border p-5 text-center shadow-sm',
          ticket.length > 0 ? 'bg-primary text-primary-foreground' : 'bg-card',
        )}>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Total</p>
          <p className="text-5xl font-black tabular-nums leading-none">
            {ticket.length > 0 ? formatMXN(total) : '$0.00'}
          </p>
          <p className="mt-1 text-xs opacity-60">{ticket.reduce((s, i) => s + i.cantidad, 0)} artículo(s)</p>
        </div>

        {/* Método de pago */}
        <select
          value={metodoPagoId}
          onChange={(e) => setMetodoPagoId(e.target.value)}
          className="rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {metodosPago.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>

        {/* Pago recibido */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Pago recibido</label>
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

        {/* Billetes rápidos */}
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

        {/* Cambio */}
        {cambio !== null && (
          <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-center">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Cambio</p>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
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
  )
}
