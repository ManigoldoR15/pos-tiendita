'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { crearClienteAction } from './actions'

const inputCls = 'w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500'
const selectCls = 'w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500'
const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'
const sectionTitleCls = 'text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4'

export default function NuevoClientePage() {
  const [state, action, pending] = useActionState(crearClienteAction, null)

  return (
    <div className="max-w-lg space-y-6">
      {/* Back */}
      <Link
        href="/admin-sistema"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Nuevo cliente</h1>
        <p className="mt-1 text-sm text-slate-400">
          Se enviará una invitación al email del dueño para que active su cuenta.
        </p>
      </div>

      {/* Formulario */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6">
        <form action={action} className="space-y-6">

          {/* Negocio */}
          <div className="space-y-4">
            <p className={sectionTitleCls}>Negocio</p>
            <div>
              <label className={labelCls}>Nombre del negocio *</label>
              <input
                name="nombre"
                required
                placeholder="Tiendita La Esperanza"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Ubicación</label>
              <input
                name="ubicacion"
                placeholder="Colonia, Ciudad, Estado"
                className={inputCls}
              />
            </div>
          </div>

          {/* Dueño */}
          <div className="space-y-4">
            <p className={sectionTitleCls}>Dueño</p>
            <div>
              <label className={labelCls}>Nombre completo *</label>
              <input
                name="nombre_dueno"
                required
                placeholder="Juan García"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Correo electrónico *</label>
              <input
                name="email_dueno"
                type="email"
                required
                placeholder="juan@ejemplo.com"
                className={inputCls}
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                Se enviará la invitación a este correo.
              </p>
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input
                name="telefono_dueno"
                type="tel"
                placeholder="614 123 4567"
                className={inputCls}
              />
            </div>
          </div>

          {/* Suscripción */}
          <div className="space-y-4">
            <p className={sectionTitleCls}>Suscripción inicial</p>
            <div>
              <label className={labelCls}>Plan *</label>
              <select name="plan" defaultValue="prueba" className={selectCls}>
                <option value="prueba">Prueba gratuita</option>
                <option value="mensual">Mensual</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>

          {/* Error */}
          {state?.error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-950/30 border border-red-700/40 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{state.error}</p>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 h-10 rounded-lg bg-violet-600 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60 transition-colors"
            >
              {pending ? 'Creando…' : 'Crear cliente y enviar invitación'}
            </button>
            <Link
              href="/admin-sistema"
              className="h-10 flex items-center rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
