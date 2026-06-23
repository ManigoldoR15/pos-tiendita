'use client'

import { cambiarRolEmpleadoAction } from './actions-empleados'

export default function SelectorRolEmpleado({
  userId,
  rolActual,
}: {
  userId: string
  rolActual: string
}) {
  return (
    <form action={cambiarRolEmpleadoAction}>
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="rol"
        defaultValue={rolActual}
        onChange={(e) => e.target.form?.requestSubmit()}
        className="rounded-lg border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="empleado">Empleado</option>
      </select>
    </form>
  )
}
