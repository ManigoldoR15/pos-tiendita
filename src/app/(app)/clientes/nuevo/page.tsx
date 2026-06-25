'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { crearClienteAction, type CrearClienteState } from './actions'

export default function NuevoClientePage() {
  const [state, action, pending] = useActionState<CrearClienteState, FormData>(
    crearClienteAction,
    null,
  )

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/clientes"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </Link>
      </div>

      <h1 className="text-2xl font-black tracking-tight">Nuevo cliente</h1>

      <form action={action} className="flex flex-col gap-5">
        {state?.error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm font-medium text-destructive">
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nombre" className="text-sm font-medium">
            Nombre <span className="text-destructive">*</span>
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            placeholder="Ej: María López"
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="telefono" className="text-sm font-medium">
            Teléfono <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            placeholder="Ej: 5512345678"
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Con teléfono podrás cobrar fiados por WhatsApp
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="notas" className="text-sm font-medium">
            Notas <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="notas"
            name="notas"
            placeholder="Ej: cliente frecuente, alérgico a..."
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={pending} className="flex-1 py-3 text-base">
            {pending ? 'Guardando...' : 'Guardar cliente'}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/clientes">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
