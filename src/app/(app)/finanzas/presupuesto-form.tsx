'use client'

import { useRef, useState, useTransition } from 'react'
import { actualizarPresupuestoAction } from './actions'
import { formatMXN } from '@/lib/dinero'

export default function PresupuestoForm({
  categoriaId,
  presupuestoActual,
}: {
  categoriaId: string
  presupuestoActual: number | null
}) {
  const [editando, setEditando] = useState(false)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  if (!editando) {
    return (
      <button
        onClick={() => setEditando(true)}
        className="text-xs text-muted-foreground hover:text-primary transition-colors tabular-nums"
        title="Editar presupuesto"
      >
        {presupuestoActual ? formatMXN(presupuestoActual) : '+ Presupuesto'}
      </button>
    )
  }

  return (
    <form
      action={(fd) => {
        startTransition(() => actualizarPresupuestoAction(fd))
        setEditando(false)
      }}
      className="flex items-center gap-1"
    >
      <input type="hidden" name="categoria_id" value={categoriaId} />
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        <input
          ref={inputRef}
          type="number"
          name="presupuesto"
          min="0"
          step="0.01"
          defaultValue={presupuestoActual ? (presupuestoActual / 100).toFixed(2) : ''}
          placeholder="0.00"
          autoFocus
          className="w-24 rounded border bg-background pl-5 pr-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => e.key === 'Escape' && setEditando(false)}
        />
      </div>
      <button type="submit" disabled={pending} className="text-xs text-primary hover:underline">
        {pending ? '…' : 'OK'}
      </button>
      <button type="button" onClick={() => setEditando(false)} className="text-xs text-muted-foreground hover:underline">
        ✕
      </button>
    </form>
  )
}
