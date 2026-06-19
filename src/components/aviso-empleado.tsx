'use client'

import { useRef, useEffect, useActionState } from 'react'
import { Megaphone, X, Send } from 'lucide-react'
import { enviarMensajeAction, type MensajeState } from '@/app/(app)/notificaciones/actions'
import { cn } from '@/lib/utils'

export default function AvisoEmpleado() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [state, dispatch, pending] = useActionState<MensajeState, FormData>(enviarMensajeAction, null)

  // Cerrar y limpiar cuando el envío es exitoso
  useEffect(() => {
    if (state?.ok) {
      const timer = setTimeout(() => {
        dialogRef.current?.close()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.ok])

  function abrir() {
    dialogRef.current?.showModal()
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function cerrar() {
    dialogRef.current?.close()
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        title="Avisar al jefe"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Megaphone className="h-4 w-4" />
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-sm rounded-2xl border bg-card p-0 shadow-xl backdrop:bg-black/40 open:flex open:flex-col"
        onClick={(e) => { if (e.target === dialogRef.current) cerrar() }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Avisar al jefe</h2>
          </div>
          <button
            type="button"
            onClick={cerrar}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {state?.ok ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
            <span className="text-3xl">✅</span>
            <p className="font-medium">Aviso enviado</p>
            <p className="text-sm text-muted-foreground">El jefe lo verá en su bandeja</p>
          </div>
        ) : (
          <form action={dispatch} className="flex flex-col gap-4 p-5">
            <div>
              <label htmlFor="aviso-mensaje" className="mb-1.5 block text-sm font-medium">
                ¿Qué quieres avisar?
              </label>
              <textarea
                ref={textareaRef}
                id="aviso-mensaje"
                name="mensaje"
                rows={4}
                maxLength={500}
                placeholder='Ej: "Se acabó el gas", "Falta cambio en caja", "Vino el proveedor"'
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                required
                minLength={3}
              />
              {state?.error && (
                <p className="mt-1.5 text-xs text-destructive">{state.error}</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrar}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity',
                  pending && 'opacity-60 cursor-not-allowed',
                )}
              >
                <Send className="h-3.5 w-3.5" />
                {pending ? 'Enviando…' : 'Enviar aviso'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  )
}
