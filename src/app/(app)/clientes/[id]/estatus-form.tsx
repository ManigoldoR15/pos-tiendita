'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setEstatusClienteAction, getEstatusSugeridoAction, type EstatusClienteType } from './actions-estatus'

type Opcion = {
  valor: EstatusClienteType
  emoji: string
  label: string
  activeBg: string
  activeBorder: string
  activeText: string
}

const OPCIONES: Opcion[] = [
  {
    valor: 'verde',
    emoji: '😊',
    label: 'Buen cliente',
    activeBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    activeBorder: 'border-emerald-500',
    activeText: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    valor: 'amarillo',
    emoji: '😐',
    label: 'Con pendientes',
    activeBg: 'bg-yellow-50 dark:bg-yellow-900/20',
    activeBorder: 'border-yellow-500',
    activeText: 'text-yellow-700 dark:text-yellow-300',
  },
  {
    valor: 'rojo',
    emoji: '😟',
    label: 'Cliente difícil',
    activeBg: 'bg-red-50 dark:bg-red-900/20',
    activeBorder: 'border-red-500',
    activeText: 'text-red-700 dark:text-red-300',
  },
]

type Props = {
  clienteId: string
  estatusActual: EstatusClienteType | null
  notaActual: string | null
}

export default function EstatusForm({ clienteId, estatusActual, notaActual }: Props) {
  const [pending, startTransition] = useTransition()
  const [seleccionado, setSeleccionado] = useState<EstatusClienteType | null>(estatusActual)
  const [nota, setNota] = useState(notaActual ?? '')
  const [sugerencia, setSugerencia] = useState<{ sugerido: EstatusClienteType | null; razon: string } | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changed =
    seleccionado !== estatusActual || nota.trim() !== (notaActual ?? '')

  function guardar() {
    setError(null)
    setGuardado(false)
    startTransition(async () => {
      const res = await setEstatusClienteAction(clienteId, seleccionado, nota.trim() || null)
      if (res.error) { setError(res.error); return }
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    })
  }

  function calcularSugerencia() {
    setSugerencia(null)
    startTransition(async () => {
      const res = await getEstatusSugeridoAction(clienteId)
      setSugerencia(res)
      if (res.sugerido) setSeleccionado(res.sugerido)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Estatus del cliente</h2>
        <Button variant="ghost" size="sm" onClick={calcularSugerencia} disabled={pending}>
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Sugerir
        </Button>
      </div>

      {sugerencia && (
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Sugerencia: </span>
          {sugerencia.razon || 'Sin datos suficientes'}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {OPCIONES.map(({ valor, emoji, label, activeBg, activeBorder, activeText }) => {
          const activo = seleccionado === valor
          return (
            <button
              key={valor}
              type="button"
              onClick={() => setSeleccionado(activo ? null : valor)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all',
                activo
                  ? `${activeBg} ${activeBorder} ${activeText}`
                  : 'border-border hover:bg-muted/50 text-muted-foreground',
              )}
            >
              <span className="text-2xl leading-none select-none">{emoji}</span>
              <span className="text-xs font-medium leading-tight">{label}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Nota (opcional)</label>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej. Siempre paga a tiempo, pide descuentos frecuentes…"
          rows={2}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button className="w-full" onClick={guardar} disabled={pending || !changed}>
        {pending ? (
          'Guardando…'
        ) : guardado ? (
          <span className="flex items-center gap-1.5">
            <Check className="h-4 w-4" />
            Guardado
          </span>
        ) : (
          'Guardar estatus'
        )}
      </Button>
    </div>
  )
}
