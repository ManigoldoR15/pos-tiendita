'use client'

import { useEffect, useMemo, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { Printer, Minus, Plus, Barcode, Search } from 'lucide-react'
import { formatMXN } from '@/lib/dinero'
import { asignarCodigosAction } from './actions'

type Producto = {
  id: string
  nombre: string
  precio_venta: number
  codigo_barras: string | null
}

export default function EtiquetasClient({ productos }: { productos: Producto[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [codigos, setCodigos] = useState<Record<string, string>>(
    Object.fromEntries(productos.filter((p) => p.codigo_barras).map((p) => [p.id, p.codigo_barras!])),
  )
  const [listo, setListo] = useState(false) // etiquetas renderizadas, listas para imprimir
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return productos
    return productos.filter((p) => p.nombre.toLowerCase().includes(q))
  }, [busqueda, productos])

  const seleccion = productos.filter((p) => (cantidades[p.id] ?? 0) > 0)
  const totalEtiquetas = seleccion.reduce((s, p) => s + (cantidades[p.id] ?? 0), 0)

  function cambiar(id: string, delta: number) {
    setListo(false)
    setCantidades((prev) => {
      const n = Math.max(0, Math.min(99, (prev[id] ?? 0) + delta))
      return { ...prev, [id]: n }
    })
  }

  async function generar() {
    setError(null)
    setTrabajando(true)
    try {
      const sinCodigo = seleccion.filter((p) => !codigos[p.id]).map((p) => p.id)
      if (sinCodigo.length > 0) {
        const res = await asignarCodigosAction(sinCodigo)
        if ('error' in res && typeof res.error === 'string') {
          setError(res.error)
          return
        }
        setCodigos((prev) => ({ ...prev, ...(res as Record<string, string>) }))
      }
      setListo(true)
    } finally {
      setTrabajando(false)
    }
  }

  // Dibujar los códigos de barras cuando la zona de impresión está lista
  useEffect(() => {
    if (!listo) return
    document.querySelectorAll<SVGSVGElement>('svg[data-codigo]').forEach((el) => {
      try {
        JsBarcode(el, el.dataset.codigo!, {
          format: 'CODE128',
          width: 1.4,
          height: 34,
          fontSize: 11,
          displayValue: true,
          margin: 0,
        })
      } catch {
        // código inválido: la etiqueta sale sin barras pero con texto
      }
    })
  }, [listo, codigos])

  return (
    <>
      {/* ── Selección (no se imprime) ── */}
      <div className="space-y-4 print:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="card-soft divide-y max-h-[420px] overflow-y-auto">
          {filtrados.map((p) => {
            const qty = cantidades[p.id] ?? 0
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {codigos[p.id] ?? 'Sin código — se generará al imprimir'}
                    {' · '}{formatMXN(p.precio_venta)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => cambiar(p.id, -1)}
                    disabled={qty === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent disabled:opacity-30 transition-colors"
                    aria-label={`Menos etiquetas de ${p.nombre}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center text-sm font-bold tabular-nums">{qty}</span>
                  <button
                    onClick={() => cambiar(p.id, +1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent transition-colors"
                    aria-label={`Más etiquetas de ${p.nombre}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
          {filtrados.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sin resultados</p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={generar}
            disabled={totalEtiquetas === 0 || trabajando}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Barcode className="h-4 w-4" />
            {trabajando ? 'Generando…' : `Generar ${totalEtiquetas} etiqueta${totalEtiquetas !== 1 ? 's' : ''}`}
          </button>
          {listo && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-accent transition-colors"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
          )}
        </div>
      </div>

      {/* ── Vista previa / zona de impresión ── */}
      {listo && (
        <div className="etiquetas-print">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 print:grid-cols-4 print:gap-[3mm]">
            {seleccion.flatMap((p) =>
              Array.from({ length: cantidades[p.id] ?? 0 }, (_, i) => (
                <div
                  key={`${p.id}-${i}`}
                  className="flex flex-col items-center justify-between rounded border border-dashed border-muted-foreground/40 p-1.5 print:break-inside-avoid"
                >
                  <p className="w-full truncate text-center text-[10px] font-semibold leading-tight text-black dark:text-foreground print:text-black">
                    {p.nombre}
                  </p>
                  <svg data-codigo={codigos[p.id] ?? ''} className="max-w-full" />
                  <p className="text-[10px] font-bold text-black dark:text-foreground print:text-black">
                    {formatMXN(p.precio_venta)}
                  </p>
                </div>
              )),
            )}
          </div>
        </div>
      )}

      {/* Al imprimir: solo las etiquetas, fondo blanco */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .etiquetas-print, .etiquetas-print * { visibility: visible; }
          .etiquetas-print { position: absolute; inset: 0; background: #fff; }
          .etiquetas-print svg { background: #fff; }
        }
      `}</style>
    </>
  )
}
