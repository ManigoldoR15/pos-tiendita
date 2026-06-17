'use client'

import { useActionState } from 'react'
import { CheckCircle } from 'lucide-react'
import { actualizarSuscripcionAction } from './actions'

type Props = {
  negocio: {
    id: string
    nombre: string
    email_dueno: string | null
    nombre_dueno: string | null
    telefono_dueno: string | null
    ubicacion: string | null
    plan: string
    suscripcion_inicio: string | null
    suscripcion_fin: string | null
    suspendido: boolean
    notas_admin: string | null
  }
}

export default function SuscripcionForm({ negocio: n }: Props) {
  const [state, action, pending] = useActionState(actualizarSuscripcionAction, null)

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="negocio_id" value={n.id} />

      {/* Info del negocio */}
      <fieldset className="card-soft p-5 space-y-4">
        <legend className="px-1 text-sm font-semibold">Información del negocio</legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre del negocio *</label>
            <input
              name="nombre_negocio"
              required
              defaultValue={n.nombre}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ubicación</label>
            <input
              name="ubicacion"
              defaultValue={n.ubicacion ?? ''}
              placeholder="Ciudad, Estado"
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre del dueño</label>
            <input
              name="nombre_dueno"
              defaultValue={n.nombre_dueno ?? ''}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email del dueño</label>
            <input
              name="email_dueno"
              type="email"
              defaultValue={n.email_dueno ?? ''}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Teléfono</label>
            <input
              name="telefono_dueno"
              defaultValue={n.telefono_dueno ?? ''}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </fieldset>

      {/* Suscripción */}
      <fieldset className="card-soft p-5 space-y-4">
        <legend className="px-1 text-sm font-semibold">Suscripción</legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Plan</label>
            <select
              name="plan"
              defaultValue={n.plan}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="prueba">Prueba gratuita</option>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Inicio</label>
            <input
              type="date"
              name="suscripcion_inicio"
              defaultValue={n.suscripcion_inicio ?? ''}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Vencimiento</label>
            <input
              type="date"
              name="suscripcion_fin"
              defaultValue={n.suscripcion_fin ?? ''}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Suspensión */}
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <input
            type="hidden"
            name="suspendido"
            value={n.suspendido ? 'true' : 'false'}
          />
          <SuspendidoToggle defaultValue={n.suspendido} />
        </div>
      </fieldset>

      {/* Notas internas */}
      <fieldset className="card-soft p-5 space-y-2">
        <legend className="px-1 text-sm font-semibold">Notas internas</legend>
        <textarea
          name="notas_admin"
          defaultValue={n.notas_admin ?? ''}
          rows={3}
          placeholder="Solo visibles para el superadmin..."
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </fieldset>

      {state && 'error' in state && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state && 'ok' in state && (
        <p className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" /> Cambios guardados.
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {pending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

function SuspendidoToggle({ defaultValue }: { defaultValue: boolean }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer w-full">
      <input
        type="checkbox"
        name="suspendido"
        value="true"
        defaultChecked={defaultValue}
        className="mt-0.5 h-4 w-4 accent-red-600"
        onChange={(e) => {
          // Sync hidden input
          const hidden = e.currentTarget.closest('form')?.querySelector<HTMLInputElement>('input[type=hidden][name=suspendido]')
          if (hidden) hidden.value = e.currentTarget.checked ? 'true' : 'false'
        }}
      />
      <div>
        <p className="text-sm font-semibold text-red-700">Cuenta suspendida</p>
        <p className="text-xs text-red-600 mt-0.5">
          Los usuarios de este negocio no podrán acceder hasta que se reactive.
        </p>
      </div>
    </label>
  )
}
