'use client'

import { useActionState, useState } from 'react'
import { crearNuevoEmpleadoAction, agregarEmpleadoAction, type EmpleadoState } from './actions-empleados'
import { Button } from '@/components/ui/button'
import { UserPlus, Eye, EyeOff } from 'lucide-react'

export default function FormEmpleado() {
  const [modo, setModo] = useState<'crear' | 'existente'>('crear')
  const [rolNuevo, setRolNuevo] = useState('empleado')
  const [verPassword, setVerPassword] = useState(false)

  const [stateCrear, actionCrear, pendingCrear] = useActionState<EmpleadoState, FormData>(
    crearNuevoEmpleadoAction,
    null,
  )
  const [stateExistente, actionExistente, pendingExistente] = useActionState<EmpleadoState, FormData>(
    agregarEmpleadoAction,
    null,
  )

  const state = modo === 'crear' ? stateCrear : stateExistente
  const pending = modo === 'crear' ? pendingCrear : pendingExistente

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex rounded-lg border p-0.5 bg-muted/40 w-fit">
        <button
          type="button"
          onClick={() => setModo('crear')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            modo === 'crear' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Crear cuenta nueva
        </button>
        <button
          type="button"
          onClick={() => setModo('existente')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            modo === 'existente' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Agregar existente
        </button>
      </div>

      {modo === 'crear' ? (
        <form action={actionCrear} className="space-y-3">
          {state?.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}
          {state?.ok && (
            <p className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              ✓ {state.mensaje}
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Correo electrónico</label>
            <input
              type="email"
              name="email"
              required
              placeholder="empleado@ejemplo.com"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Contraseña temporal</label>
            <div className="relative">
              <input
                type={verPassword ? 'text' : 'password'}
                name="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-lg border bg-background px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Rol</label>
            <select
              name="rol"
              value={rolNuevo}
              onChange={(e) => setRolNuevo(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="empleado">Empleado (solo POS)</option>
              <option value="administrador">Administrador (sin Config)</option>
            </select>
          </div>

          <Button type="submit" disabled={pending} size="sm" className="w-full">
            <UserPlus className="h-4 w-4" />
            {pending ? 'Creando…' : 'Crear empleado'}
          </Button>
        </form>
      ) : (
        <form action={actionExistente} className="space-y-2">
          {state?.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}
          {state?.ok && (
            <p className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              ✓ Empleado agregado.
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="email"
              name="email"
              required
              placeholder="correo@ejemplo.com"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" disabled={pending} size="sm">
              <UserPlus className="h-4 w-4" />
              {pending ? 'Buscando…' : 'Agregar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            El usuario debe tener cuenta existente en la aplicación.
          </p>
        </form>
      )}
    </div>
  )
}
