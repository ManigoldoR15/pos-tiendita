'use client'

import { useTransition, useState } from 'react'
import { MapPin, ShieldCheck } from 'lucide-react'
import { actualizarLicenciaPlazasAction } from './actions'

type PlazaInfo = { id: string; nombre: string; direccion: string | null; color: string; activo: boolean }

export default function LicenciaForm({
  negocioId,
  maxPlazas,
  numPlazas,
  plazas,
}: {
  negocioId: string
  maxPlazas: number
  numPlazas: number
  plazas: PlazaInfo[]
}) {
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(false)
  const [valor, setValor] = useState(maxPlazas)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  function handleSave() {
    setError(null)
    setOk(false)
    start(async () => {
      const res = await actualizarLicenciaPlazasAction(negocioId, valor)
      if (res.error) {
        setError(res.error)
      } else {
        setOk(true)
        setEditing(false)
      }
    })
  }

  const pct = maxPlazas > 0 ? Math.round((numPlazas / maxPlazas) * 100) : 100

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-violet-400" />
          <p className="text-sm font-semibold text-slate-200">Licencia de plazas</p>
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

      {/* Contador */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{numPlazas} plazas activas</span>
            <span>límite: {maxPlazas}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-orange-500' : 'bg-violet-500'}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black text-white tabular-nums">{numPlazas}<span className="text-slate-500 text-sm font-normal">/{maxPlazas}</span></p>
          {pct >= 100 && (
            <p className="text-[10px] text-orange-400 font-semibold">Límite alcanzado</p>
          )}
        </div>
      </div>

      {/* Form edición */}
      {editing && (
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-3">
          <p className="text-xs text-slate-400">Número máximo de plazas habilitadas:</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={numPlazas}
              max={20}
              value={valor}
              onChange={(e) => setValor(parseInt(e.target.value) || 1)}
              className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white text-center tabular-nums focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleSave}
              disabled={pending || valor < 1}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors"
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={() => { setEditing(false); setValor(maxPlazas); setError(null) }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
      {ok && <p className="text-xs text-emerald-400">Licencia actualizada.</p>}

      {/* Lista de plazas */}
      {plazas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Plazas registradas</p>
          {plazas.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 rounded-lg bg-slate-800/40 px-3 py-2">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-sm text-slate-200 flex-1 truncate">{p.nombre}</span>
              {p.direccion && (
                <span className="flex items-center gap-1 text-[10px] text-slate-500 hidden sm:flex">
                  <MapPin className="h-3 w-3" />{p.direccion}
                </span>
              )}
              {!p.activo && (
                <span className="text-[10px] text-slate-600 font-semibold">inactiva</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
