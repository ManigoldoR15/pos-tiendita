'use client'

import { useActionState, useState } from 'react'
import { TIPOS_NEGOCIO, ESTADOS_MX } from '@/lib/tipos-negocio'
import { actualizarPerfilNegocioAction } from './actions'
import type { ConfigState } from './actions'

type Props = {
  tipoActual: string
  ciudadActual: string | null
  estadoActual: string | null
  inscritoSat: boolean
  rfcActual: string | null
}

export default function FormPerfilNegocio({ tipoActual, ciudadActual, estadoActual, inscritoSat, rfcActual }: Props) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(
    actualizarPerfilNegocioAction,
    null,
  )
  const [showRfc, setShowRfc] = useState(inscritoSat)

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Tipo de negocio */}
        <div className="col-span-2 space-y-1.5">
          <label className="text-sm text-muted-foreground">Tipo de negocio</label>
          <select
            name="tipo_negocio"
            defaultValue={tipoActual}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(TIPOS_NEGOCIO).map(([k, v]) => (
              <option key={k} value={k}>{v.emoji} {v.label}</option>
            ))}
          </select>
        </div>

        {/* Ciudad */}
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Ciudad</label>
          <input
            name="ciudad"
            defaultValue={ciudadActual ?? ''}
            placeholder="ej. Guadalajara"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Estado */}
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Estado</label>
          <select
            name="estado_mx"
            defaultValue={estadoActual ?? ''}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Sin especificar —</option>
            {ESTADOS_MX.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      {/* SAT */}
      <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-border p-3.5 hover:bg-muted/40 transition-colors">
        <input
          type="checkbox"
          name="inscrito_sat"
          defaultChecked={inscritoSat}
          onChange={(e) => setShowRfc(e.target.checked)}
          className="h-4 w-4 rounded accent-primary"
        />
        <div>
          <p className="text-sm font-medium">Estoy inscrito en el SAT</p>
          <p className="text-xs text-muted-foreground">Tengo RFC y emito facturas o ticket electrónico</p>
        </div>
      </label>

      {showRfc && (
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">RFC</label>
          <input
            name="rfc"
            defaultValue={rfcActual ?? ''}
            placeholder="ej. XAXX010101000"
            maxLength={13}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">Se imprimirá en la nota de remisión</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        {state && 'success' in state && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{state.success}</p>
        )}
        {state && 'error' in state && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
      </div>
    </form>
  )
}
