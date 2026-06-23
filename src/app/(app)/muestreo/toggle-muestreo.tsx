'use client'

import { useState, useTransition } from 'react'
import { Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { activarMuestreoAction, desactivarMuestreoAction } from './actions'

type Props = {
  periodoActivo: { id: string; nombre: string | null; fecha_inicio: string } | null
}

function fmtFecha(iso: string) {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export default function ToggleMuestreo({ periodoActivo }: Props) {
  const [pending, startTransition] = useTransition()
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)

  function activar() {
    setError(null)
    startTransition(async () => {
      const res = await activarMuestreoAction(nombre)
      if (res.error) { setError(res.error); return }
      setNombre('')
    })
  }

  function desactivar() {
    if (!periodoActivo) return
    setError(null)
    startTransition(async () => {
      const res = await desactivarMuestreoAction(periodoActivo.id)
      if (res.error) setError(res.error)
    })
  }

  if (periodoActivo) {
    return (
      <div className="card-soft p-5 space-y-3 border-2 border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/10">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#22c55e] animate-pulse" />
          <p className="font-bold text-emerald-700 dark:text-emerald-400">Muestreo activo</p>
        </div>
        {periodoActivo.nombre && (
          <p className="text-sm font-medium">{periodoActivo.nombre}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Iniciado el {fmtFecha(periodoActivo.fecha_inicio)}
        </p>
        <p className="text-xs text-muted-foreground">
          Los cajeros verán el mini-formulario después de cada venta.
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={desactivar}
          disabled={pending}
        >
          <Square className="h-3.5 w-3.5 mr-1.5" />
          {pending ? 'Deteniendo…' : 'Detener muestreo'}
        </Button>
      </div>
    )
  }

  return (
    <div className="card-soft p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
        <p className="font-bold text-muted-foreground">Muestreo inactivo</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Cuando actives el muestreo, después de cada venta aparecerá un mini-formulario
        opcional para que el cajero registre el perfil del cliente.
      </p>
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Nombre del periodo (opcional, ej. Julio semana 1)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && activar()}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button size="sm" onClick={activar} disabled={pending}>
          <Play className="h-3.5 w-3.5 mr-1.5" />
          {pending ? 'Activando…' : 'Iniciar muestreo'}
        </Button>
      </div>
    </div>
  )
}
