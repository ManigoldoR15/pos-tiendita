'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { anularVentaAction } from './actions'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

export default function BotonAnular({ ventaId }: { ventaId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function handleClick() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setError(null)
    setPending(true)
    const result = await anularVentaAction(ventaId)
    if ('error' in result) {
      setError(result.error)
      setConfirming(false)
      setPending(false)
    } else {
      router.refresh()
    }
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
