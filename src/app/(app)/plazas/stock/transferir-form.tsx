'use client'

import { useActionState, useEffect, useState } from 'react'
import { ArrowRightLeft, Check, X } from 'lucide-react'
import { transferirStockAction } from '../actions'
import { formatUnidad } from '@/lib/dinero'

/** '' = pool global (stock sin plaza asignada) */
export type Lugar = { id: string; nombre: string; color: string }

export type Linea = {
  /** productoId + '|' + varianteId — lo que espera la server action */
  key: string
  nombre: string
  unidad: string
  /** cuánto hay de esta línea en cada lugar, por id de lugar ('' = pool) */
  stock: Record<string, number>
}

export default function TransferirForm({
  lugares,
  lineas,
}: {
  lugares: Lugar[]
  lineas: Linea[]
}) {
  const [state, action, pending] = useActionState(transferirStockAction, null)
  const [abierto, setAbierto] = useState(false)
  const [lineaKey, setLineaKey] = useState('')
  const [desde, setDesde] = useState('')

  useEffect(() => {
    if (state?.ok) {
      setAbierto(false)
      setLineaKey('')
      setDesde('')
    }
  }, [state])

  const linea = lineas.find((l) => l.key === lineaKey)
  const origenes = linea ? lugares.filter((lu) => (linea.stock[lu.id] ?? 0) > 0) : []
  const disponible = linea ? (linea.stock[desde] ?? 0) : 0
  const destinos = lugares.filter((lu) => lu.id !== desde)

  if (!abierto) {
    return (
      <div className="space-y-2">
        {state?.ok && (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4 shrink-0" />
            Stock transferido.
          </p>
        )}
        <button
          onClick={() => setAbierto(true)}
          disabled={lineas.length === 0}
          className="w-full rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground"
        >
          <ArrowRightLeft className="mr-1.5 inline h-4 w-4" />
          Transferir stock entre plazas
        </button>
      </div>
    )
  }

  return (
    <form action={action} className="card-soft space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Transferir stock</p>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Producto</label>
        <select
          name="linea"
          required
          value={lineaKey}
          onChange={(e) => {
            setLineaKey(e.target.value)
            setDesde('')
          }}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Elige un producto —</option>
          {lineas.map((l) => (
            <option key={l.key} value={l.key}>{l.nombre}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">De</label>
          <select
            name="desde"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            disabled={!linea}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="">— Origen —</option>
            {origenes.map((lu) => (
              <option key={lu.id || 'pool'} value={lu.id}>
                {lu.nombre} ({formatUnidad(linea!.stock[lu.id] ?? 0, linea!.unidad)})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">A</label>
          <select
            name="hacia"
            required
            disabled={!linea}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            {destinos.map((lu) => (
              <option key={lu.id || 'pool'} value={lu.id}>{lu.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          Cantidad {linea && desde && `— disponible: ${formatUnidad(disponible, linea.unidad)}`}
        </label>
        <input
          name="cantidad"
          type="number"
          step="0.001"
          min="0.001"
          max={disponible || undefined}
          required
          disabled={!linea || !desde}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !linea || !desde}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {pending ? 'Moviendo…' : 'Transferir'}
      </button>
    </form>
  )
}
