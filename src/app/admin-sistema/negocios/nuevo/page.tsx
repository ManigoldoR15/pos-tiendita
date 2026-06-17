'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { crearClienteAction } from './actions'

export default function NuevoClientePage() {
  const [state, action, pending] = useActionState(crearClienteAction, null)

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin-sistema/negocios"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Negocios
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Nuevo cliente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Se enviará un correo de invitación al dueño para que active su cuenta.
        </p>
      </div>

      <form action={action} className="card-soft p-6 space-y-5">
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Negocio
          </legend>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre del negocio *</label>
            <input
              name="nombre"
              required
              placeholder="Tiendita La Esperanza"
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ubicación</label>
            <input
              name="ubicacion"
              placeholder="Colonia, Ciudad, Estado"
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Dueño
          </legend>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre del dueño *</label>
            <input
              name="nombre_dueno"
              required
              placeholder="Juan García"
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Correo electrónico *</label>
            <input
              name="email_dueno"
              type="email"
              required
              placeholder="juan@ejemplo.com"
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              Se enviará la invitación a este correo.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Teléfono</label>
            <input
              name="telefono_dueno"
              type="tel"
              placeholder="614 123 4567"
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Suscripción
          </legend>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Plan *</label>
            <select
              name="plan"
              defaultValue="prueba"
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="prueba">Prueba gratuita</option>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
          </div>
        </fieldset>

        {state?.error && (
          <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 h-10 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {pending ? 'Creando...' : 'Crear cliente y enviar invitación'}
          </button>
          <Link
            href="/admin-sistema/negocios"
            className="h-10 flex items-center rounded-lg border px-4 text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
