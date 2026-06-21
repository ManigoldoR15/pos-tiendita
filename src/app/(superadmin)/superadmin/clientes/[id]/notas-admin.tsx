'use client'

import { useState, useTransition } from 'react'
import { guardarNotasAdminAction } from '../../negocios/[id]/actions'

export default function NotasAdmin({
  negocioId,
  notasActuales,
}: {
  negocioId: string
  notasActuales: string | null
}) {
  const [notas, setNotas] = useState(notasActuales ?? '')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      await guardarNotasAdminAction(negocioId, notas)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Notas internas (solo tú las ves)</p>
      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={4}
        placeholder="Ej: Cliente interesado en plan anual. Contactar en agosto. Solicitó soporte por X..."
        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Guardando…' : 'Guardar notas'}
        </button>
        {saved && <p className="text-xs text-emerald-400">Guardado</p>}
      </div>
    </div>
  )
}
