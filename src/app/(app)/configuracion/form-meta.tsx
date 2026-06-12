'use client'

import { useActionState } from 'react'
import { guardarMetaAction, type MetaState } from './actions-meta'
import { Button } from '@/components/ui/button'
import { formatMXN } from '@/lib/dinero'

export default function FormMeta({ metaActual }: { metaActual: number | null }) {
  const [state, action, pending] = useActionState<MetaState, FormData>(
    guardarMetaAction,
    null,
  )

  const defaultVal = metaActual ? (metaActual / 100).toFixed(2) : ''

  return (
    <form action={action} className="space-y-2">
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-600">Meta guardada.</p>}

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <input
            type="number"
            name="meta_ventas"
            min="1"
            step="0.01"
            required
            defaultValue={defaultVal}
            placeholder="15000.00"
            className="w-full rounded-lg border bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? 'Guardando…' : metaActual ? 'Actualizar' : 'Establecer'}
        </Button>
      </div>
      {metaActual && (
        <p className="text-xs text-muted-foreground">
          Meta actual: <strong>{formatMXN(metaActual)}</strong>
        </p>
      )}
    </form>
  )
}
