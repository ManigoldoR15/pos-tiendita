'use client'

import { useActionState } from 'react'
import { CheckCircle, AlertTriangle } from 'lucide-react'
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

const inputCls = 'w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500'
const selectCls = 'w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500'
const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

export default function SuscripcionForm({ negocio: n }: Props) {
  const [state, action, pending] = useActionState(actualizarSuscripcionAction, null)

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="negocio_id" value={n.id} />

      {/* Datos del negocio */}
      <div className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Información del negocio
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Nombre del negocio *</label>
            <input
              name="nombre_negocio"
              required
              defaultValue={n.nombre}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Ubicación</label>
            <input
              name="ubicacion"
              defaultValue={n.ubicacion ?? ''}
              placeholder="Ciudad, Estado"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Nombre del dueño</label>
            <input name="nombre_dueno" defaultValue={n.nombre_dueno ?? ''} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email del dueño</label>
            <input name="email_dueno" type="email" defaultValue={n.email_dueno ?? ''} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Teléfono</label>
            <input name="telefono_dueno" defaultValue={n.telefono_dueno ?? ''} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Suscripción */}
      <div className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Suscripción</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Plan</label>
            <select name="plan" defaultValue={n.plan} className={selectCls}>
              <option value="prueba">Prueba gratuita</option>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Inicio</label>
            <input
              type="date"
              name="suscripcion_inicio"
              defaultValue={n.suscripcion_inicio ?? ''}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Vencimiento</label>
            <input
              type="date"
              name="suscripcion_fin"
              defaultValue={n.suscripcion_fin ?? ''}
              className={inputCls}
            />
          </div>
        </div>

        {/* Suspensión */}
        <div className="flex items-start gap-3 rounded-xl border border-red-800/40 bg-red-950/20 p-4">
          <input
            type="hidden"
            name="suspendido"
            value={n.suspendido ? 'true' : 'false'}
          />
          <SuspendidoToggle defaultValue={n.suspendido} />
        </div>
      </div>

      {/* Notas internas */}
      <div className="space-y-2">
        <label className={labelCls}>Notas internas (solo visibles para el superadmin)</label>
        <textarea
          name="notas_admin"
          defaultValue={n.notas_admin ?? ''}
          rows={3}
          placeholder="Historial de contacto, observaciones, etc."
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
        />
      </div>

      {/* Feedback */}
      {state && 'error' in state && (
        <div className="flex items-center gap-2 rounded-lg bg-red-950/30 border border-red-700/40 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{state.error}</p>
        </div>
      )}
      {state && 'ok' in state && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/30 border border-emerald-700/40 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">Cambios guardados correctamente.</p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-lg bg-violet-600 px-6 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60 transition-colors"
      >
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </button>
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
        className="mt-0.5 h-4 w-4 accent-red-500"
        onChange={(e) => {
          const hidden = e.currentTarget.closest('form')?.querySelector<HTMLInputElement>('input[type=hidden][name=suspendido]')
          if (hidden) hidden.value = e.currentTarget.checked ? 'true' : 'false'
        }}
      />
      <div>
        <p className="text-sm font-semibold text-red-400">Cuenta suspendida</p>
        <p className="text-xs text-red-500/80 mt-0.5">
          Los usuarios de este negocio no podrán acceder hasta que se reactive.
        </p>
      </div>
    </label>
  )
}
