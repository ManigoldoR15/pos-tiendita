'use client'

import { useState, useTransition } from 'react'
import { FlaskConical } from 'lucide-react'
import { toggleDemoAction } from './actions'
import { cn } from '@/lib/utils'

// Marca/desmarca un negocio como demo (Fase 5). Los demo siguen funcionando
// normal, pero no cuentan en KPIs, estudios ni cobranza del superadmin.

export default function DemoToggle({ negocioId, esDemo }: { negocioId: string; esDemo: boolean }) {
  const [demo, setDemo] = useState(esDemo)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const siguiente = !demo
    startTransition(async () => {
      const res = await toggleDemoAction(negocioId, siguiente)
      if (res && 'ok' in res) setDemo(siguiente)
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      title={demo
        ? 'Marcado como demo: no cuenta en KPIs ni cobranza. Clic para volverlo real.'
        : 'Negocio real: cuenta en KPIs. Clic para marcarlo como demo.'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50',
        demo
          ? 'border-slate-500 bg-slate-700/60 text-slate-300'
          : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300 hover:border-slate-500',
      )}
    >
      <FlaskConical className="h-3.5 w-3.5" />
      {isPending ? 'Guardando…' : demo ? 'Demo ✓' : 'Marcar demo'}
    </button>
  )
}
