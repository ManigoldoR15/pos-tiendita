'use client'

import { useState, useTransition } from 'react'
import { Send, Check, Megaphone, User, Users } from 'lucide-react'
import { mensajeAEmpleadosAction } from './actions-mensaje-empleados'
import { cn } from '@/lib/utils'

type Empleado = { user_id: string; email: string; nombre: string }

const MENSAJES_RAPIDOS = [
  'Cierra a las 6pm hoy',
  'No fiar a nadie hoy',
  'Hay promoción en refresco',
  'Espera visita del proveedor',
]

export default function MensajeEmpleadosForm({ empleados }: { empleados: Empleado[] }) {
  const [destinatario, setDestinatario] = useState<string | null>(null) // null = todos
  const [custom, setCustom] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function enviar(msg: string) {
    if (!msg.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await mensajeAEmpleadosAction(msg, destinatario)
      if (res?.error) {
        setError(`No se pudo enviar: ${res.error}`)
        return
      }
      setEnviado(true)
      setCustom('')
      setTimeout(() => setEnviado(false), 3000)
    })
  }

  const destLabel = destinatario
    ? (empleados.find((e) => e.user_id === destinatario)?.nombre ?? 'Empleado')
    : 'Todos los empleados'

  return (
    <div className="card-soft overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <Megaphone className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold">Mensaje a empleados</span>
        {enviado && (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Enviado a {destLabel}
          </span>
        )}
        {error && (
          <span className="ml-auto text-xs font-medium text-destructive">{error}</span>
        )}
      </div>

      {/* Selector de destinatario */}
      <div className="border-b px-4 py-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Para:</p>
        <div className="flex flex-wrap gap-2">
          {/* Opción "Todos" */}
          <button
            onClick={() => setDestinatario(null)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              destinatario === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-accent',
            )}
          >
            <Users className="h-3 w-3" />
            Todos
          </button>

          {/* Un botón por empleado */}
          {empleados.map((e) => (
            <button
              key={e.user_id}
              onClick={() => setDestinatario(e.user_id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                destinatario === e.user_id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent',
              )}
            >
              <User className="h-3 w-3" />
              {e.nombre}
            </button>
          ))}

          {empleados.length === 0 && (
            <span className="text-xs text-muted-foreground">Sin empleados registrados</span>
          )}
        </div>
      </div>

      {/* Mensajes rápidos */}
      <div className="grid grid-cols-2 gap-2 p-4">
        {MENSAJES_RAPIDOS.map((msg) => (
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

      {/* Campo libre */}
      <div className="border-t px-4 pb-4 pt-3">
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={`Escribir mensaje para ${destLabel.toLowerCase()}…`}
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
