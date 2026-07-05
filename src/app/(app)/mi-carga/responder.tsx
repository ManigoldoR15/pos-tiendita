'use client'

import { useActionState, useState } from 'react'
import { Check, X } from 'lucide-react'
import { responderEntregaAction, type RespuestaState } from './actions'
import { cn } from '@/lib/utils'

export default function Responder({ entregaId }: { entregaId: string }) {
  const [state, action, pending] = useActionState<RespuestaState, FormData>(responderEntregaAction, null)
  const [rechazando, setRechazando] = useState(false)

  if (state?.error) {
    return <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
  }

  return (
    <div className="mt-4 space-y-3">
      {!rechazando ? (
        <div className="flex gap-2">
          <form action={action} className="flex-1">
            <input type="hidden" name="entrega_id" value={entregaId} />
            <input type="hidden" name="aceptar" value="true" />
            <button
              type="submit"
              disabled={pending}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90',
                pending && 'opacity-60',
              )}
            >
              <Check className="h-4 w-4" />
              {pending ? 'Confirmando…' : 'Sí, la recibí'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setRechazando(true)}
            disabled={pending}
            className="flex items-center justify-center gap-1.5 rounded-xl border px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-rose-300 hover:text-rose-600"
          >
            <X className="h-4 w-4" />
            No coincide
          </button>
        </div>
      ) : (
        <form action={action} className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
          <input type="hidden" name="entrega_id" value={entregaId} />
          <input type="hidden" name="aceptar" value="false" />
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
            ¿Qué está mal? El inventario se le regresa al dueño.
          </p>
          <input
            name="nota"
            maxLength={200}
            autoFocus
            placeholder="Ej. Me dieron 8 y aquí dice 10"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? 'Enviando…' : 'Rechazar carga'}
            </button>
            <button
              type="button"
              onClick={() => setRechazando(false)}
              disabled={pending}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
