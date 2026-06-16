'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatMXN, textoCentavos, centavosATexto } from '@/lib/dinero'
import { fmtFechaCorta } from '@/lib/fecha'
import { registrarAbonoAction } from '../actions'

type Nota = { ventaId: string; fecha: string; deuda: number }

type Props = {
  clienteId: string
  deudaTotal: number
  notasPendientes: Nota[]
}

export default function FormAbono({ clienteId, deudaTotal, notasPendientes }: Props) {
  const router = useRouter()
  const [monto, setMonto] = useState('')
  const [ventaId, setVentaId] = useState<string>('')
  const [notas, setNotas] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const montoNum = textoCentavos(monto)
  const maxMonto = ventaId
    ? (notasPendientes.find((n) => n.ventaId === ventaId)?.deuda ?? deudaTotal)
    : deudaTotal

  async function handleAbono() {
    if (montoNum <= 0) { setError('Ingresa un monto válido.'); return }
    setError(null)
    setPending(true)
    const result = await registrarAbonoAction({
      cliente_id: clienteId,
      monto: montoNum,
      venta_id: ventaId || null,
      notas: notas.trim() || undefined,
    })
    setPending(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      setMonto('')
      setNotas('')
      setVentaId('')
      router.refresh()
    }
  }

  async function handleSaldarTodo() {
    setError(null)
    setPending(true)
    const result = await registrarAbonoAction({
      cliente_id: clienteId,
      monto: deudaTotal,
      venta_id: null,
      notas: 'Saldo total',
    })
    setPending(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <h2 className="font-semibold text-base">Registrar pago</h2>

      {/* Selector de nota (opcional) */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Aplicar a (opcional)</label>
        <select
          value={ventaId}
          onChange={(e) => setVentaId(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Abono general (nota más antigua primero)</option>
          {notasPendientes.map((n) => (
            <option key={n.ventaId} value={n.ventaId}>
              {fmtFechaCorta(n.fecha)} — resta {formatMXN(n.deuda)}
            </option>
          ))}
        </select>
      </div>

      {/* Monto */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Monto del abono</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder={centavosATexto(maxMonto)}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full rounded-lg border border-input bg-background py-2 pl-7 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Máximo: {formatMXN(maxMonto)}
        </p>
      </div>

      {/* Notas */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Nota (opcional)</label>
        <input
          type="text"
          placeholder="Ej. Pagó a las 3pm"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="flex-1"
          disabled={pending || !monto.trim()}
          onClick={handleAbono}
        >
          {pending ? 'Guardando…' : 'Registrar abono'}
        </Button>
        <Button
          variant="outline"
          className="flex-1 border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          disabled={pending}
          onClick={handleSaldarTodo}
        >
          Saldar todo ({formatMXN(deudaTotal)})
        </Button>
      </div>
    </section>
  )
}
