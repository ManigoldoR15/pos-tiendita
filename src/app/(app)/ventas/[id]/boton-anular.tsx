'use client'

import { useTransition, useState } from 'react'
import { anularVentaAction } from './actions'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

export default function BotonAnular({ ventaId }: { ventaId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function handleClick() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await anularVentaAction(ventaId)
      if (result && 'error' in result) {
        setError(result.error)
        setConfirming(false)
      }
    })
  }

  return (
    <div className="space-y-2">
      {confirming && !pending && (
        <p className="text-sm text-destructive font-medium">
          ¿Confirmar anulación? Se restaurará el stock.
        </p>
      )}
      <div className="flex gap-2">
        {confirming && !pending && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Cancelar
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={handleClick}
          className="gap-1.5"
        >
          <XCircle className="h-4 w-4" />
          {pending ? 'Anulando…' : confirming ? 'Sí, anular' : 'Anular venta'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
