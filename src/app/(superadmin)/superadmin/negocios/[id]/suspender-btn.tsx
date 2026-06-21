'use client'

import { useTransition } from 'react'
import { Ban, CheckCircle } from 'lucide-react'
import { toggleSuspenderAction } from './actions'

export default function SuspenderNegocioBtn({
  negocioId,
  suspendido,
  nombre,
}: {
  negocioId: string
  suspendido: boolean
  nombre: string
}) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    const msg = suspendido
      ? `¿Reactivar el negocio "${nombre}"?`
      : `¿Suspender el negocio "${nombre}"? Los usuarios no podrán acceder.`
    if (!confirm(msg)) return
    startTransition(async () => { await toggleSuspenderAction(negocioId, !suspendido) })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
        suspendido
          ? 'border-emerald-700/50 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
          : 'border-red-700/50 bg-red-900/30 text-red-400 hover:bg-red-900/50'
      }`}
    >
      {suspendido ? (
        <><CheckCircle className="h-4 w-4" /> Reactivar</>
      ) : (
        <><Ban className="h-4 w-4" /> Suspender</>
      )}
    </button>
  )
}
