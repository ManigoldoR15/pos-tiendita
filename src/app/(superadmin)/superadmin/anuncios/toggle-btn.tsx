'use client'

import { useTransition } from 'react'
import { toggleAnuncioAction } from './actions'
import { Eye, EyeOff } from 'lucide-react'

export default function ToggleAnuncioBtn({ id, activo }: { id: string; activo: boolean }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      onClick={() => startTransition(async () => { await toggleAnuncioAction(id, !activo) })}
      disabled={isPending}
      title={activo ? 'Desactivar' : 'Activar'}
      className="shrink-0 rounded-lg p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-40"
    >
      {activo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  )
}
