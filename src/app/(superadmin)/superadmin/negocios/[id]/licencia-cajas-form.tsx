'use client'

import { useTransition, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { actualizarLicenciaCajasAction } from './actions'

export default function LicenciaCajasForm({
  negocioId,
  maxCajas,
  numCajas,
}: {
  negocioId: string
  maxCajas: number
  numCajas: number
}) {
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(false)
  const [valor, setValor] = useState(maxCajas)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  function handleSave() {
    setError(null)
    setOk(false)
    start(async () => {
      const res = await actualizarLicenciaCajasAction(negocioId, valor)
      if (res.error) {
        setError(res.error)
      } else {
        setOk(true)
        setEditing(false)
      }
    })
  }

  const pct = maxCajas > 0 ? Math.round((numCajas / maxCajas) * 100) : 100

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-emerald-400" />
          <p className="text-sm font-semibold text-slate-200">Límite de cajas</p>
        </div>
        {!editing && (
          <button
            onClick={() => { setEditing(true); setOk(false) }}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Editar
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{numCajas} caja{numCajas !== 1 ? 's' : ''} abierta{numCajas !== 1 ? 's' : ''}</span>
            <span>límite: {maxCajas}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-orange-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black text-white tabular-nums">
            {numCajas}<span className="text-slate-500 text-sm font-normal">/{maxCajas}</span>
          </p>
          {pct >= 100 && (
            <p className="text-[10px] text-orange-400 font-semibold">Límite alcanzado</p>
          )}
        </div>
      </div>

      {editing && (
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-3">
          <p className="text-xs text-slate-400">Número máximo de cajas simultáneas:</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={Math.max(numCajas, 1)}
              max={99}
              value={valor}
              onChange={(e) => setValor(parseInt(e.target.value) || 1)}
              className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white text-center tabular-nums focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleSave}
              disabled={pending || valor < 1}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors"
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={() => { setEditing(false); setValor(maxCajas); setError(null) }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
      {ok && <p className="text-xs text-emerald-400">Límite de cajas actualizado.</p>}
    </div>
  )
}
