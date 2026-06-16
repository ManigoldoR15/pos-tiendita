'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cambiarListaNegraAction } from '../actions'

type Props = {
  clienteId: string
  enListaNegra: boolean
  motivoActual: string | null | undefined
}

export default function FormListaNegra({ clienteId, enListaNegra, motivoActual }: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAgregar() {
    setError(null)
    setPending(true)
    const result = await cambiarListaNegraAction({
      cliente_id: clienteId,
      en_lista_negra: true,
      motivo: motivo.trim() || undefined,
    })
    setPending(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      setAbierto(false)
      setMotivo('')
      router.refresh()
    }
  }

  async function handleQuitar() {
    setError(null)
    setPending(true)
    const result = await cambiarListaNegraAction({
      cliente_id: clienteId,
      en_lista_negra: false,
    })
    setPending(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <section className="rounded-xl border border-destructive/30 bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Ban className="h-4 w-4 text-destructive" />
        <h2 className="font-semibold text-base">Lista negra</h2>
      </div>

      {enListaNegra ? (
        <>
          <p className="text-sm text-muted-foreground">
            Este cliente está en lista negra y no puede recibir fiado.
            {motivoActual && <> Motivo: <strong>{motivoActual}</strong></>}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button variant="outline" disabled={pending} onClick={handleQuitar} className="w-full">
            {pending ? 'Quitando…' : 'Quitar de lista negra'}
          </Button>
        </>
      ) : abierto ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Motivo (recomendado)</label>
            <input
              autoFocus
              type="text"
              placeholder="Ej. No pagó en 3 meses"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAgregar()}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAbierto(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" disabled={pending} onClick={handleAgregar}>
              {pending ? 'Guardando…' : 'Agregar a lista negra'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Al agregar a lista negra, el POS bloqueará cualquier fiado a este cliente.
          </p>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setAbierto(true)}
          >
            <Ban className="h-4 w-4" />
            Agregar a lista negra
          </Button>
        </>
      )}
    </section>
  )
}
