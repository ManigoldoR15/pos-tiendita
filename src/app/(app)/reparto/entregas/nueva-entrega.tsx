'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Plus, Minus, Trash2, Send, PackageCheck } from 'lucide-react'
import { crearEntregaAction, type EntregaState } from './actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Producto = { id: string; nombre: string; existencias: number; codigo_barras: string | null }
type Repartidor = { id: string; nombre: string }
type Plaza = { id: string; nombre: string; color: string }
type Linea = { producto_id: string; nombre: string; cantidad: number; max: number }

export default function NuevaEntrega({
  repartidores,
  productos,
  plazas,
}: {
  repartidores: Repartidor[]
  productos: Producto[]
  plazas: Plaza[]
}) {
  const [repartidorId, setRepartidorId] = useState(repartidores[0]?.id ?? '')
  const [localId, setLocalId] = useState('')
  const [busca, setBusca] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [state, action, pending] = useActionState<EntregaState, FormData>(crearEntregaAction, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok) {
      setLineas([])
      setBusca('')
    }
  }, [state])

  const enCarrito = useMemo(() => new Set(lineas.map((l) => l.producto_id)), [lineas])

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return []
    return productos
      .filter((p) => p.nombre.toLowerCase().includes(q) || (p.codigo_barras ?? '').includes(q))
      .slice(0, 8)
  }, [busca, productos])

  function agregar(p: Producto) {
    if (enCarrito.has(p.id)) return
    setLineas((prev) => [...prev, { producto_id: p.id, nombre: p.nombre, cantidad: 1, max: p.existencias }])
    setBusca('')
  }

  function setCantidad(id: string, cant: number) {
    setLineas((prev) =>
      prev.map((l) => (l.producto_id === id ? { ...l, cantidad: Math.max(1, Math.min(l.max, cant)) } : l)),
    )
  }

  function quitar(id: string) {
    setLineas((prev) => prev.filter((l) => l.producto_id !== id))
  }

  const totalUds = lineas.reduce((s, l) => s + l.cantidad, 0)

  return (
    <form ref={formRef} action={action} className="card-soft space-y-4 p-5">
      <input type="hidden" name="repartidor_id" value={repartidorId} />
      <input type="hidden" name="local_id" value={localId} />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad })))}
      />

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
          ✓ Entrega registrada. Le aparecerá al repartidor para que la confirme.
        </p>
      )}

      {/* Repartidor + plaza */}
      <div className={cn('grid gap-3', plazas.length > 0 ? 'sm:grid-cols-2' : '')}>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Entregar a</label>
          <select
            value={repartidorId}
            onChange={(e) => setRepartidorId(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {repartidores.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>
        {plazas.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Sale de la plaza</label>
            <select
              value={localId}
              onChange={(e) => setLocalId(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Inventario general</option>
              {plazas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Buscador de productos */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Agregar productos a la carga</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Busca por nombre o código…"
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {resultados.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-card shadow-lg">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregar(p)}
                  disabled={p.existencias <= 0 || enCarrito.has(p.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-40"
                >
                  <span className="truncate">{p.nombre}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{p.existencias} en stock</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Líneas de la carga */}
      {lineas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
          <PackageCheck className="h-7 w-7 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Busca productos arriba para armar la carga.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {lineas.map((l) => (
            <li key={l.producto_id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.nombre}</p>
                <p className="text-[11px] text-muted-foreground">Disponible: {l.max}</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setCantidad(l.producto_id, l.cantidad - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border hover:bg-accent">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  type="number"
                  value={l.cantidad}
                  min={1}
                  max={l.max}
                  onChange={(e) => setCantidad(l.producto_id, Number(e.target.value))}
                  className="w-14 rounded-lg border bg-background px-2 py-1 text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button type="button" onClick={() => setCantidad(l.producto_id, l.cantidad + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border hover:bg-accent">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" onClick={() => quitar(l.producto_id)} className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Nota (opcional)</label>
        <input
          name="nota"
          maxLength={300}
          placeholder="Ej. Ruta del centro, cobrar de contado"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalUds > 0 ? <><strong className="text-foreground tabular-nums">{totalUds}</strong> unidades en la carga</> : 'Sin productos aún'}
        </p>
        <Button type="submit" disabled={pending || lineas.length === 0 || !repartidorId} className="gap-1.5">
          <Send className="h-4 w-4" />
          {pending ? 'Registrando…' : 'Entregar carga'}
        </Button>
      </div>
    </form>
  )
}
