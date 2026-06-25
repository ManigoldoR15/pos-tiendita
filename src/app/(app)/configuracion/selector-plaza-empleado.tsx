'use client'

import { useTransition } from 'react'
import { asignarLocalEmpleadoAction } from './plazas/actions'

type Plaza = { id: string; nombre: string; color: string }

export default function SelectorPlazaEmpleado({
  userId,
  localIdActual,
  plazas,
}: {
  userId: string
  localIdActual: string | null
  plazas: Plaza[]
}) {
  const [pending, start] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value || null
    start(async () => {
      const res = await asignarLocalEmpleadoAction(userId, val)
      if (res.error) alert(res.error)
    })
  }

  if (plazas.length <= 1) return null

  return (
    <select
      value={localIdActual ?? ''}
      onChange={handleChange}
      disabled={pending}
      className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 max-w-[130px]"
      title="Plaza asignada"
    >
      <option value="">Todas las plazas</option>
      {plazas.map((p) => (
        <option key={p.id} value={p.id}>{p.nombre}</option>
      ))}
    </select>
  )
}
