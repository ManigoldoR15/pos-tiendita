'use client'

import { useTransition } from 'react'
import { toggleSospecha } from './actions'
import { AlertTriangle, ShieldCheck } from 'lucide-react'

export function SospechaBadge({
  negocioId,
  sospecha,
}: {
  negocioId: string | null
  sospecha: boolean
}) {
  const [pending, startTransition] = useTransition()

  if (!negocioId) return null

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => toggleSospecha(negocioId, !sospecha))}
      title={sospecha ? 'Quitar marca de sospecha' : 'Marcar como sospecha de cuenta compartida'}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
        sospecha
          ? 'bg-red-950/60 text-red-400 hover:bg-red-900/60 border border-red-800/50'
          : 'bg-slate-800 text-slate-500 hover:bg-amber-950/50 hover:text-amber-400 border border-slate-700'
      }`}
    >
      {sospecha ? (
        <>
          <AlertTriangle className="h-3 w-3" />
          Sospecha
        </>
      ) : (
        <>
          <ShieldCheck className="h-3 w-3" />
          Marcar
        </>
      )}
    </button>
  )
}
