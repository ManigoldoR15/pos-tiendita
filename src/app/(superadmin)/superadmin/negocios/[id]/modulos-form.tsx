'use client'

import { useTransition, useState } from 'react'
import { Puzzle, Check } from 'lucide-react'
import { actualizarModulosAction } from './actions'
import { MODULOS_META, PAQUETES } from '@/lib/modulos-config'
import type { ModuloKey, ModulosConfig } from '@/lib/modulos-config'

export default function ModulosForm({
  negocioId,
  modulosActuales,
}: {
  negocioId: string
  modulosActuales: ModulosConfig
}) {
  const [pending, start] = useTransition()
  const [valores, setValores] = useState<ModulosConfig>({ ...modulosActuales })
  const [ok, setOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function aplicarPaquete(key: string) {
    const paquete = PAQUETES[key]
    const nuevo: ModulosConfig = {
      fiados: false, granel: false, turnos: false, exportacion: false,
      multi_plaza: false, clientes_frecuentes: false, proveedores: false, metas: false,
      repartidores: false,
    }
    for (const m of paquete.modulos) nuevo[m] = true
    setValores(nuevo)
    setOk(false)
  }

  function toggle(key: ModuloKey) {
    setValores((v) => ({ ...v, [key]: !v[key] }))
    setOk(false)
  }

  function handleSave() {
    setError(null)
    setOk(false)
    start(async () => {
      const res = await actualizarModulosAction(negocioId, valores)
      if (res.error) setError(res.error)
      else setOk(true)
    })
  }

  const activos = (Object.keys(valores) as ModuloKey[]).filter((k) => valores[k]).length
  const total = Object.keys(MODULOS_META).length

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Puzzle className="h-4 w-4 text-violet-400" />
        <p className="text-sm font-semibold text-slate-200">Módulos habilitados</p>
        <span className="ml-auto text-xs text-slate-500">
          {activos}/{total} activos
        </span>
      </div>

      {/* Paquetes rápidos */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Paquetes rápidos</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PAQUETES).map(([key, pkg]) => (
            <button
              key={key}
              type="button"
              onClick={() => aplicarPaquete(key)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-violet-500 hover:text-violet-400"
            >
              {pkg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles individuales */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Módulos individuales</p>
        <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 overflow-hidden">
          {(Object.entries(MODULOS_META) as [ModuloKey, { label: string; desc: string }][]).map(([key, meta]) => (
            <label
              key={key}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/60 transition-colors"
            >
              <button
                type="button"
                role="switch"
                aria-checked={valores[key]}
                onClick={() => toggle(key)}
                className={[
                  'relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none',
                  valores[key] ? 'bg-violet-600' : 'bg-slate-700',
                ].join(' ')}
              >
                <span className={[
                  'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  valores[key] ? 'translate-x-4' : 'translate-x-0',
                ].join(' ')} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">{meta.label}</p>
                <p className="text-xs text-slate-500">{meta.desc}</p>
              </div>
              {valores[key] && <Check className="h-3.5 w-3.5 shrink-0 text-violet-400" />}
            </label>
          ))}
        </div>
      </div>

      {/* Guardar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white transition-colors"
        >
          {pending ? 'Guardando…' : 'Guardar módulos'}
        </button>
        {ok    && <p className="text-xs text-emerald-400">Módulos actualizados.</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <p className="text-[10px] text-slate-600">
        El núcleo (POS, cobro, inventario, corte de caja) siempre está activo y no aparece aquí.
      </p>
    </div>
  )
}
