'use client'

import { useRouter } from 'next/navigation'

type Miembro = { user_id: string; email: string; rol: string }

export default function EmpleadoSelect({
  miembros,
  vendedor,
  periodo,
  desde,
  hasta,
}: {
  miembros: Miembro[]
  vendedor: string
  periodo: string
  desde?: string
  hasta?: string
}) {
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    const params = new URLSearchParams({ p: periodo })
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    if (v && v !== 'todos') params.set('vendedor', v)
    router.push(`/ventas?${params.toString()}`)
  }

  return (
    <select
      value={vendedor}
      onChange={handleChange}
      className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="todos">Todos los vendedores</option>
      {miembros.map((m) => (
        <option key={m.user_id} value={m.user_id}>
          {m.email}
        </option>
      ))}
    </select>
  )
}
