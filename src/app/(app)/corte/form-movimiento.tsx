'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { textoCentavos, formatMXN } from '@/lib/dinero'
import { registrarMovimientoCajaAction } from './actions'

type Tipo = 'retiro' | 'ingreso'

const TEXTOS: Record<Tipo, { titulo: string; ayuda: string; ejemplo: string; boton: string }> = {
  retiro: {
    titulo: 'Sacar dinero de la caja',
    ayuda: 'Dinero que sacas del cajón y no es un gasto ni mercancía. Se descuenta de lo que debe haber al cerrar.',
    ejemplo: 'Ej. me llevé para el banco',
    boton: 'Sacar',
  },
  ingreso: {
    titulo: 'Meter dinero a la caja',
    ayuda: 'Dinero que metes al cajón y no es una venta. Se suma a lo que debe haber al cerrar.',
    ejemplo: 'Ej. puse cambio de mi bolsa',
    boton: 'Meter',
  },
}

export default function FormMovimientoCaja() {
  const router = useRouter()
  const [abierto, setAbierto] = useState<Tipo | null>(null)
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const montoNum = textoCentavos(monto)

  function abrir(tipo: Tipo) {
    setAbierto(tipo)
    setMonto('')
    setMotivo('')
    setError(null)
  }

  async function guardar() {
    if (!abierto) return
    if (montoNum <= 0) { setError('Escribe cuánto dinero es.'); return }
    if (!motivo.trim()) { setError('Escribe para qué fue. Sin motivo no se guarda.'); return }

    setError(null)
    setPending(true)
    const res = await registrarMovimientoCajaAction({
      tipo: abierto,
      monto: montoNum,
      motivo: motivo.trim(),
    })
    setPending(false)

    if ('error' in res) {
      setError(res.error)
      return
    }
    setAbierto(null)
    setMonto('')
    setMotivo('')
    router.refresh()
  }

  if (!abierto) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => abrir('retiro')}
          className="flex items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-accent"
        >
          <ArrowUpCircle className="h-4 w-4 text-destructive" />
          Sacar dinero
        </button>
        <button
          onClick={() => abrir('ingreso')}
          className="flex items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-accent"
        >
          <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
          Meter dinero
        </button>
      </div>
    )
  }

  const t = TEXTOS[abierto]

  return (
    <div className="card-soft space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold">{t.titulo}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t.ayuda}</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">¿Cuánto?</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <input
            autoFocus
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full rounded-lg border border-input bg-background py-2 pl-7 pr-3 text-lg font-bold outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">¿Para qué?</label>
        <input
          type="text"
          placeholder={t.ejemplo}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setAbierto(null)} disabled={pending}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={guardar} disabled={pending}>
          {pending ? 'Guardando…' : `${t.boton} ${montoNum > 0 ? formatMXN(montoNum) : ''}`}
        </Button>
      </div>
    </div>
  )
}
