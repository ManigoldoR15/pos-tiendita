'use client'

import { useTransition } from 'react'
import { actualizarPresupuestoAction } from './actions'

export default function PresupuestoCell({
  categoriaId,
  presupuestoActual,
}: {
  categoriaId: string
  presupuestoActual: number | null
}) {
  const [pending, start] = useTransition()

  function submit(e: React.FocusEvent<HTMLInputElement>) {
    const val = e.currentTarget.value.trim()
    const fd = new FormData()
    fd.set('categoria_id', categoriaId)
    fd.set('presupuesto', val)
    start(() => actualizarPresupuestoAction(fd))
  }

  return (
    <div className={`flex items-center justify-end gap-0.5 ${pending ? 'opacity-50' : ''}`}>
      <span className="text-xs text-muted-foreground">$</span>
      <input
        type="number"
        name="presupuesto"
        min="0"
        step="0.01"
        defaultValue={presupuestoActual ? (presupuestoActual / 100).toFixed(2) : ''}
        placeholder="—"
        onBlur={submit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="w-20 rounded border bg-background px-1.5 py-0.5 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
        title="Escribe y presiona Enter o Tab para guardar"
      />
    </div>
  )
}
