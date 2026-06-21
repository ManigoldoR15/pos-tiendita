'use client'

import { useState, useTransition } from 'react'
import { MessageSquare, Send, Check } from 'lucide-react'
import { avisarAlJefeAction } from './actions-avisar'

const MENSAJES = [
  'Se acabó el gas',
  'Falta cambio en caja',
  'Problema con cliente',
  'Producto dañado',
]

export default function AvisarJefeForm() {
  const [enviado, setEnviado] = useState(false)
  const [custom, setCustom] = useState('')
  const [isPending, startTransition] = useTransition()

  function enviar(msg: string) {
    if (!msg.trim()) return
    startTransition(async () => {
      await avisarAlJefeAction(msg)
      setEnviado(true)
      setCustom('')
      setTimeout(() => setEnviado(false), 3000)
    })
  }

  return (
    <div className="card-soft overflow-hidden">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold">Avisar al jefe</span>
        {enviado && (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Enviado
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 p-4">
        {MENSAJES.map((msg) => (
          <button
            key={msg}
            onClick={() => enviar(msg)}
            disabled={isPending}
            className="rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            {msg}
          </button>
        ))}
      </div>
      <div className="border-t px-4 pb-4 pt-3">
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Escribir otro aviso..."
            disabled={isPending}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && custom.trim()) {
                e.preventDefault()
                enviar(custom)
              }
            }}
          />
          <button
            onClick={() => enviar(custom)}
            disabled={!custom.trim() || isPending}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
