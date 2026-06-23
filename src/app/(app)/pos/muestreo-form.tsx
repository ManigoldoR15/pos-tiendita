'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { registrarRespuestaMuestreoAction } from '@/app/(app)/muestreo/actions'

type Props = {
  periodoId: string
  ventaId: string
  onClose: () => void
}

const EDADES = [
  { valor: 'nino',    emoji: '🧒', label: 'Niño' },
  { valor: 'joven',   emoji: '🧑', label: 'Joven' },
  { valor: 'adulto',  emoji: '👤', label: 'Adulto' },
  { valor: 'mediana', emoji: '🧓', label: 'Mediana' },
  { valor: 'mayor',   emoji: '👴', label: 'Mayor' },
] as const

const SATISFACCIONES = [
  { valor: 'buena',   emoji: '😊', label: 'Bien' },
  { valor: 'regular', emoji: '😐', label: 'Regular' },
  { valor: 'mala',    emoji: '😞', label: 'Mal' },
] as const

type EdadVal = typeof EDADES[number]['valor']
type SatisfaccionVal = typeof SATISFACCIONES[number]['valor']

export default function MuestreoForm({ periodoId, ventaId, onClose }: Props) {
  const [pending, startTransition] = useTransition()
  const [sexo, setSexo] = useState<'hombre' | 'mujer' | null>(null)
  const [edad, setEdad] = useState<EdadVal | null>(null)
  const [satisfaccion, setSatisfaccion] = useState<SatisfaccionVal | null>(null)

  function handleRegistrar() {
    startTransition(async () => {
      await registrarRespuestaMuestreoAction({
        periodoId,
        ventaId,
        sexo,
        rangoEdad: edad,
        satisfaccion,
      })
      onClose()
    })
  }

  function handleSaltar() {
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-background shadow-2xl p-5 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-bold text-base">¿Quién compró?</p>
            <p className="text-xs text-muted-foreground">Opcional · puedes saltar cada sección</p>
          </div>
          <button
            onClick={handleSaltar}
            className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sexo */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Sexo</p>
          <div className="grid grid-cols-2 gap-2">
            {(['hombre', 'mujer'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSexo(sexo === v ? null : v)}
                className={cn(
                  'rounded-xl border-2 py-3 text-sm font-medium transition-all',
                  sexo === v
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted/50',
                )}
              >
                {v === 'hombre' ? '👨 Hombre' : '👩 Mujer'}
              </button>
            ))}
          </div>
        </div>

        {/* Edad */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Edad</p>
          <div className="grid grid-cols-5 gap-1.5">
            {EDADES.map(({ valor, emoji, label }) => (
              <button
                key={valor}
                type="button"
                onClick={() => setEdad(edad === valor ? null : valor)}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-xl border-2 py-2 text-center transition-all',
                  edad === valor
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted/50',
                )}
              >
                <span className="text-lg leading-none">{emoji}</span>
                <span className="text-[10px] font-medium leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Satisfacción */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Satisfacción</p>
          <div className="grid grid-cols-3 gap-2">
            {SATISFACCIONES.map(({ valor, emoji, label }) => (
              <button
                key={valor}
                type="button"
                onClick={() => setSatisfaccion(satisfaccion === valor ? null : valor)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border-2 py-2.5 transition-all',
                  satisfaccion === valor
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted/50',
                )}
              >
                <span className="text-2xl leading-none">{emoji}</span>
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={handleSaltar} disabled={pending}>
            Saltar todo
          </Button>
          <Button className="flex-1" onClick={handleRegistrar} disabled={pending}>
            {pending ? 'Guardando…' : 'Registrar →'}
          </Button>
        </div>
      </div>
    </div>
  )
}
