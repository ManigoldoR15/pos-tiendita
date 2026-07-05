'use client'

import { useRef, useState, useTransition } from 'react'
import { MessageSquareText, Send, X, Check } from 'lucide-react'
import { mensajeAEmpleadosAction } from '../actions-mensaje-empleados'
import { cn } from '@/lib/utils'

const RAPIDOS = [
  '¿Todo bien? Veo que llevas rato detenido',
  'Repórtate por favor',
  'Cuando termines esa entrega, márcame',
  'Regresa a la tienda',
]

/** Botón de acción directa del dueño: aviso al teléfono del repartidor. */
export default function MandarAviso({ userId, nombre }: { userId: string; nombre: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<'idle' | 'ok' | 'error'>('idle')
  const [pending, start] = useTransition()

  function enviar(msg: string) {
    if (!msg.trim()) return
    start(async () => {
      const res = await mensajeAEmpleadosAction(msg, userId)
      if (res?.error) { setEstado('error'); return }
      setEstado('ok')
      setTexto('')
      setTimeout(() => { dialogRef.current?.close(); setEstado('idle') }, 1200)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={`Mandar aviso a ${nombre}`}
      >
        <MessageSquareText className="h-3.5 w-3.5" />
        Aviso
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-sm rounded-2xl border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/40"
        onClick={(e) => { if (e.target === dialogRef.current) dialogRef.current?.close() }}
      >
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <p className="text-sm font-semibold">Aviso para {nombre}</p>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {estado === 'ok' ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <Check className="h-6 w-6 text-emerald-500" />
            <p className="text-sm font-medium">Enviado — le llegará a su campanita</p>
          </div>
        ) : (
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap gap-1.5">
              {RAPIDOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={pending}
                  onClick={() => enviar(m)}
                  className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviar(texto)}
                placeholder="O escribe tu mensaje…"
                maxLength={500}
                className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                disabled={pending || !texto.trim()}
                onClick={() => enviar(texto)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90',
                  (pending || !texto.trim()) && 'opacity-50',
                )}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            {estado === 'error' && (
              <p className="text-xs text-destructive">No se pudo enviar. Intenta de nuevo.</p>
            )}
          </div>
        )}
      </dialog>
    </>
  )
}
