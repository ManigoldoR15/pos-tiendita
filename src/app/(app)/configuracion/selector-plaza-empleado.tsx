'use client'

import { useTransition } from 'react'
import { asignarLocalEmpleadoAction } from './plazas/actions'

type Plaza = { id: string; nombre: string; color: string }

export default function SelectorPlazaEmpleado({
  userId,
  localIdActual,
  plazas,
  plazasConStock = [],
}: {
  userId: string
  localIdActual: string | null
  plazas: Plaza[]
  /** ids de plazas que ya tienen mercancía */
  plazasConStock?: string[]
}) {
  const [pending, start] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value || null

    // Una plaza sin mercancía deja al empleado con el POS en blanco. Se avisa
    // antes de asignarlo, no cuando ya tiene un cliente enfrente.
    if (val && !plazasConStock.includes(val)) {
      const nombre = plazas.find((p) => p.id === val)?.nombre ?? 'Esa plaza'
      const seguir = confirm(
        `${nombre} no tiene mercancía asignada todavía.\n\n` +
        `Si dejas al empleado ahí, va a ver todos los productos como agotados y no va a poder cobrar. ` +
        `Primero mueve inventario a esa plaza.\n\n¿Asignarlo de todos modos?`,
      )
      if (!seguir) {
        e.target.value = localIdActual ?? ''
        return
      }
    }

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
