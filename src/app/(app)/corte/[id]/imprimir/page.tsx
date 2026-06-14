import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { cn } from '@/lib/utils'
import { PrintButton } from '@/components/print-button'

import { fmtFechaHora, fmtHora } from '@/lib/fecha'
function fmtFechaLarga(iso: string) { return fmtFechaHora(iso) }

export default async function ImprimirCortePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()

  const { data: corte } = await supabase
    .from('cortes_caja')
    .select('id, monto_inicial, monto_esperado, monto_contado, diferencia, fecha_apertura, fecha_cierre, estado')
    .eq('id', id)
    .eq('negocio_id', negocio.id)
    .single()

  if (!corte) notFound()
  if (corte.estado !== 'cerrado') redirect('/corte')

  const { data: ventas } = await supabase
    .from('ventas')
    .select('id, total, created_at, estado, metodos_pago(nombre)')
    .eq('corte_id', id)
    .order('created_at', { ascending: true })

  const lista = ventas ?? []
  const completadas = lista.filter((v) => v.estado === 'completada')
  const totalVentas = completadas.reduce((s, v) => s + v.total, 0)

  return (
    <div className="mx-auto max-w-lg">
      {/* Controles — ocultos al imprimir */}
      <div className="print:hidden mb-6 flex items-center gap-3">
        <Link
          href="/corte"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Corte
        </Link>
        <PrintButton />
      </div>

      {/* ── Encabezado del reporte ── */}
      <div className="text-center mb-6 space-y-1">
        <h1 className="text-2xl font-bold">{negocio.nombre}</h1>
        <p className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
          Corte de Caja
        </p>
      </div>

      {/* ── Periodo ── */}
      <div className="rounded-xl border bg-card p-4 mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Apertura</span>
          <span className="font-medium">{fmtFechaLarga(corte.fecha_apertura)}</span>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="text-muted-foreground">Cierre</span>
          <span className="font-medium">
            {corte.fecha_cierre ? fmtFechaLarga(corte.fecha_cierre) : '—'}
          </span>
        </div>
      </div>

      {/* ── Resumen de caja ── */}
      <div className="rounded-xl border bg-card p-4 mb-4 space-y-2 text-sm">
        <h2 className="font-semibold mb-3">Resumen de caja</h2>
        <Fila label="Fondo inicial" value={formatMXN(corte.monto_inicial)} />
        <Fila label={`Ventas (${completadas.length})`} value={formatMXN(totalVentas)} />
        <Fila label="Monto esperado" value={formatMXN(corte.monto_esperado ?? 0)} bold />
        <Fila label="Monto contado" value={formatMXN(corte.monto_contado ?? 0)} />
        <div className="border-t pt-2">
          <Fila
            label="Diferencia"
            value={`${(corte.diferencia ?? 0) >= 0 ? '+' : ''}${formatMXN(corte.diferencia ?? 0)}`}
            bold
            color={
              (corte.diferencia ?? 0) === 0
                ? undefined
                : (corte.diferencia ?? 0) > 0
                ? 'text-green-600'
                : 'text-destructive'
            }
          />
        </div>
      </div>

      {/* ── Tabla de ventas ── */}
      {lista.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden mb-4">
          <h2 className="font-semibold px-4 py-3 border-b text-sm">
            Ventas del turno ({completadas.length})
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Hora</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Método</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((v) => {
                const metodo =
                  (v.metodos_pago as unknown as { nombre: string } | null)?.nombre ?? '—'
                const hora = fmtHora(v.created_at)
                return (
                  <tr key={v.id} className={cn(v.estado === 'cancelada' && 'opacity-40')}>
                    <td className="px-4 py-2">{hora}</td>
                    <td className="px-3 py-2 text-muted-foreground">{metodo}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatMXN(v.total)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t bg-muted/30">
              <tr>
                <td className="px-4 py-2 font-semibold" colSpan={2}>
                  Total
                </td>
                <td className="px-4 py-2 text-right font-bold text-green-600">
                  {formatMXN(totalVentas)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Firma ── */}
      <div className="mt-10 pt-4 border-t text-xs text-muted-foreground text-center print:block hidden">
        <p>Firma responsable ____________________</p>
      </div>
    </div>
  )
}

function Fila({
  label,
  value,
  bold,
  color,
}: {
  label: string
  value: string
  bold?: boolean
  color?: string
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(bold && 'font-bold', color)}>{value}</span>
    </div>
  )
}
