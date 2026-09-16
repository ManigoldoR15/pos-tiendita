'use client'

import { useEffect, useMemo, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { Printer, Minus, Plus, Barcode, Search, Tag } from 'lucide-react'
import { formatMXN } from '@/lib/dinero'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { asignarCodigosAction, marcarEtiquetaAction } from './actions'

type Producto = {
  id: string
  nombre: string
  precio_venta: number
  codigo_barras: string | null
  lleva_etiqueta: boolean
}

export default function EtiquetasClient({ productos }: { productos: Producto[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [verTodos, setVerTodos] = useState(false)
  const [marcados, setMarcados] = useState<Record<string, boolean>>(
    Object.fromEntries(productos.map((p) => [p.id, p.lleva_etiqueta])),
  )
  // Los que se apagan estando en "Con etiqueta" se quedan a la vista (atenuados)
  // hasta cambiar de pestaña, para que un toque por error se pueda regresar.
  const [recienApagados, setRecienApagados] = useState<Set<string>>(new Set())
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [codigos, setCodigos] = useState<Record<string, string>>(
    Object.fromEntries(productos.filter((p) => p.codigo_barras).map((p) => [p.id, p.codigo_barras!])),
  )
  const [listo, setListo] = useState(false) // etiquetas renderizadas, listas para imprimir
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalMarcados = productos.filter((p) => marcados[p.id]).length

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return productos.filter((p) => {
      if (q && !p.nombre.toLowerCase().includes(q)) return false
      return verTodos || marcados[p.id] || recienApagados.has(p.id)
    })
  }, [busqueda, productos, verTodos, marcados, recienApagados])

  const seleccion = productos.filter((p) => (cantidades[p.id] ?? 0) > 0)
  const totalEtiquetas = seleccion.reduce((s, p) => s + (cantidades[p.id] ?? 0), 0)
  const marcadosVisibles = filtrados.filter((p) => marcados[p.id])

  function cambiarPestana(todos: boolean) {
    setVerTodos(todos)
    setRecienApagados(new Set())
  }

  async function marcar(id: string, valor: boolean) {
    setError(null)
    setMarcados((prev) => ({ ...prev, [id]: valor }))
    if (!valor && !verTodos) setRecienApagados((prev) => new Set(prev).add(id))
    if (!valor) setCantidad(id, 0)
    const res = await marcarEtiquetaAction(id, valor)
    if (res?.error) {
      setMarcados((prev) => ({ ...prev, [id]: !valor }))
      setError(res.error)
    }
  }

  function setCantidad(id: string, n: number) {
    setListo(false)
    setCantidades((prev) => ({ ...prev, [id]: Math.max(0, Math.min(99, n)) }))
  }

  function cambiar(id: string, delta: number) {
    const n = (cantidades[id] ?? 0) + delta
    // Pedirle etiquetas a un producto lo deja marcado para la próxima vez
    if (delta > 0 && !marcados[id]) void marcar(id, true)
    setCantidad(id, n)
  }

  function unaDeCada() {
    setListo(false)
    setCantidades((prev) => ({
      ...prev,
      ...Object.fromEntries(marcadosVisibles.map((p) => [p.id, Math.max(1, prev[p.id] ?? 0)])),
    }))
  }

  function limpiar() {
    setListo(false)
    setCantidades({})
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
        {/* Pestañas: los marcados o todo el catálogo */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cambiarPestana(false)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              !verTodos ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
            )}
          >
            <Tag className="h-3.5 w-3.5" />
            Con etiqueta ({totalMarcados})
          </button>
          <button
            type="button"
            onClick={() => cambiarPestana(true)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              verTodos ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
            )}
          >
            Todos ({productos.length})
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          {verTodos
            ? 'Prende el interruptor de los productos a los que les imprimes etiqueta. Se guarda solo y la próxima vez ya salen en "Con etiqueta".'
            : 'Si falta alguno, búscalo en "Todos" y préndele su interruptor. Apágalo si el producto ya trae su código de fábrica.'}
        </p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {marcadosVisibles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={unaDeCada}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              Poner 1 a cada uno
            </button>
            {totalEtiquetas > 0 && (
              <button
                type="button"
                onClick={limpiar}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                Quitar todas
              </button>
            )}
          </div>
        )}

        <div className="card-soft divide-y max-h-[420px] overflow-y-auto">
          {filtrados.map((p) => {
            const qty = cantidades[p.id] ?? 0
            const marcado = marcados[p.id] ?? false
            return (
              <div
                key={p.id}
                className={cn('flex items-center gap-3 px-4 py-2.5', !marcado && !verTodos && 'opacity-50')}
              >
                <Switch
                  checked={marcado}
                  onChange={(v) => void marcar(p.id, v)}
                  label={`Le imprimo etiqueta a ${p.nombre}`}
                />
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
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {busqueda ? (
                'Sin resultados'
              ) : (
                <>
                  <p>Todavía no marcas productos para etiqueta.</p>
                  <button
                    type="button"
                    onClick={() => cambiarPestana(true)}
                    className="mt-2 font-medium text-primary hover:underline"
                  >
                    Ver todos los productos y elegir
                  </button>
                </>
              )}
            </div>
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
