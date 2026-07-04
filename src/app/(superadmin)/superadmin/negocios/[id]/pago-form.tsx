'use client'

import { useActionState } from 'react'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import { registrarPagoAction } from './actions'

// Registro manual de un cobro de suscripción (Fase 3).
// Al guardar, sa_registrar_pago extiende negocios.suscripcion_fin.

const inputCls = 'w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500'
const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

export default function PagoForm({ negocioId, planActual, hoy }: {
  negocioId: string
  planActual: string | null
  hoy: string
}) {
  const [state, action, pending] = useActionState(registrarPagoAction, null)

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="negocio_id" value={negocioId} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelCls}>Monto (MXN) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
            <input
              name="monto"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="199.00"
              className={`${inputCls} pl-7`}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Plan pagado *</label>
          <select
            name="plan"
            defaultValue={planActual === 'anual' ? 'anual' : 'mensual'}
            className={inputCls}
          >
            <option value="mensual">Mensual (+1 mes)</option>
            <option value="anual">Anual (+1 año)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Fecha de pago</label>
          <input type="date" name="fecha_pago" defaultValue={hoy} max={hoy} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Método</label>
          <select name="metodo" defaultValue="efectivo" className={inputCls}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Notas (opcional)</label>
        <input name="notas" placeholder="Referencia, folio, acuerdo…" className={inputCls} />
      </div>

      {state && 'error' in state && (
        <div className="flex items-center gap-2 rounded-lg bg-red-950/30 border border-red-700/40 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{state.error}</p>
        </div>
      )}
      {state && 'ok' in state && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/30 border border-emerald-700/40 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">
            Pago registrado. La suscripción ahora vence el <strong>{state.periodoFin}</strong>.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-lg bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition-colors"
      >
        {pending ? 'Registrando…' : 'Registrar pago'}
      </button>
    </form>
  )
}
