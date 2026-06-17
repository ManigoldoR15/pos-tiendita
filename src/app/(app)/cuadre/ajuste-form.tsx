'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatCantidad } from '@/lib/unidades'
import { fmtFechaCorta } from '@/lib/fecha'
import { registrarAjusteAction, type MotivoAjuste } from './actions'

type Lote = {
  id: string
  cantidad_actual: number
  fecha_recepcion: string
  fecha_caducidad: string | null
  notas: string | null
}

type Props = {
  productoId: string
  productoNombre: string
  unidadMedida: string
  lotes: Lote[]
}

const MOTIVOS: { value: MotivoAjuste; label: string }[] = [
  { value: 'error_conteo', label: 'Error de conteo' },
  { value: 'merma', label: 'Merma / desecho' },
  { value: 'robo', label: 'Robo / faltante' },
  { value: 'devolucion', label: 'Devolución / entrada' },
  { value: 'otro', label: 'Otro motivo' },
]

export default function AjusteForm({ productoId, productoNombre, unidadMedida, lotes }: Props) {
  const router = useRouter()
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '')
  const [cantidadFisica, setCantidadFisica] = useState('')
  const [motivo, setMotivo] = useState<MotivoAjuste>('error_conteo')
  const [notas, setNotas] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)

  const loteActual = lotes.find((l) => l.id === loteId)
  const cantidadActual = loteActual ? Number(loteActual.cantidad_actual) : 0
  const cantidadNum = parseFloat(cantidadFisica)
  const delta = cantidadFisica ? cantidadNum - cantidadActual : null

  async function handleSubmit() {
    if (!loteId) { setError('Selecciona un lote'); return }
    if (!cantidadFisica || isNaN(cantidadNum) || cantidadNum < 0) {
      setError('Ingresa una cantidad física válida (puede ser 0)'); return
    }
    setError(null)
    setPending(true)
    const result = await registrarAjusteAction({
      producto_id: productoId,
      lote_id: loteId,
      cantidad_fisica: cantidadNum,
      motivo,
      notas: notas.trim() || undefined,
    })
    setPending(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      setExito(true)
      setCantidadFisica('')
      setNotas('')
      setTimeout(() => { setExito(false); router.refresh() }, 1500)
    }
  }

  if (lotes.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin lotes activos para ajustar.</p>
  }

  return (
    <div className="space-y-4">
      {/* Selector de lote */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Lote</label>
        <select
          value={loteId}
          onChange={(e) => { setLoteId(e.target.value); setCantidadFisica('') }}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {fmtFechaCorta(l.fecha_recepcion)}
              {l.fecha_caducidad ? ` · cad. ${fmtFechaCorta(l.fecha_caducidad)}` : ''}
              {' · '}sistema: {formatCantidad(Number(l.cantidad_actual), unidadMedida)}
              {l.notas ? ` · ${l.notas}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Stock actual */}
      {loteActual && (
        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">Sistema dice que hay:</p>
          <p className="text-2xl font-black text-primary">
            {formatCantidad(cantidadActual, unidadMedida)}
          </p>
        </div>
      )}

      {/* Cantidad física contada */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          ¿Cuánto contaste físicamente? ({unidadMedida})
        </label>
        <div className="relative">
          <input
            type="number"
            min="0"
            step={unidadMedida === 'kg' || unidadMedida === 'litro' ? '0.001' : '1'}
            placeholder="0"
            value={cantidadFisica}
            onChange={(e) => setCantidadFisica(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-3 pr-16 text-xl font-bold outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
            {unidadMedida}
          </span>
        </div>
      </div>

      {/* Delta preview */}
      {delta !== null && (
        <div className={`rounded-lg border px-4 py-3 ${
          delta === 0
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20'
            : delta < 0
            ? 'border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/20'
            : 'border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/20'
        }`}>
          {delta === 0 ? (
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              ✓ Sin diferencia — el inventario coincide
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-muted-foreground">Diferencia</p>
              <p className={`text-xl font-black ${delta < 0 ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>
                {delta > 0 ? '+' : ''}{formatCantidad(delta, unidadMedida)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {delta < 0 ? 'Faltante en sistema vs físico' : 'Sobrante vs sistema'}
              </p>
            </>
          )}
        </div>
      )}

      {/* Motivo */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Motivo del ajuste</label>
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as MotivoAjuste)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {MOTIVOS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Notas */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notas (opcional)</label>
        <input
          type="text"
          placeholder="Ej. conteo del turno noche"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {exito && (
        <p className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          ✓ Ajuste registrado
        </p>
      )}

      <Button
        className="w-full"
        disabled={pending || !cantidadFisica || delta === 0}
        onClick={handleSubmit}
      >
        {pending ? 'Guardando…' : 'Registrar ajuste'}
      </Button>
    </div>
  )
}
