import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHora } from '@/lib/fecha'
import BotonAnular from './boton-anular'

export default async function DetalleVentaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const [supabase, rolActual] = await Promise.all([
    createClient(),
    getRolActual(),
  ])
  const puedeAnular = rolActual === 'dueno' || rolActual === 'administrador'
  const { data: venta } = await supabase
    .from('ventas')
    .select(`
      id, total, descuento, pago_recibido, cambio, created_at, estado, notas,
      metodos_pago(nombre),
      venta_items(
        id, cantidad, precio_unitario, subtotal,
        productos(nombre, precio_costo)
      )
    `)
    .eq('id', id)
    .eq('negocio_id', negocio.id)
    .single()

  if (!venta) notFound()

  const metodoPago =
    (venta.metodos_pago as unknown as { nombre: string } | null)?.nombre ?? '—'

  type ItemRaw = {
    id: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    productos: { nombre: string; precio_costo: number | null } | null
  }
  const items = (venta.venta_items as unknown as ItemRaw[]) ?? []

  const ventaSubtotal = items.reduce((s, i) => s + i.subtotal, 0)
  const descuento = (venta as unknown as { descuento: number }).descuento ?? 0
  const costoVenta = items.reduce((s, i) => s + i.cantidad * (i.productos?.precio_costo ?? 0), 0)
  const gananciaBruta = venta.total - costoVenta

  const fechaCompleta = fmtFechaHora(venta.created_at)

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/ventas"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Historial
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold">{fechaCompleta.charAt(0).toUpperCase() + fechaCompleta.slice(1)}</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{metodoPago}</span>
          {venta.estado === 'cancelada' && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              Cancelada
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                Producto
              </th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">
                Cant
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                Precio
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">
                  {item.productos?.nombre ?? 'Producto eliminado'}
                </td>
                <td className="px-3 py-3 text-center text-muted-foreground">
                  {item.cantidad}
                </td>
                <td className="px-3 py-3 text-right text-muted-foreground">
                  {formatMXN(item.precio_unitario)}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatMXN(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="border-t px-4 py-3 space-y-1.5 bg-muted/20">
          {descuento > 0 && (
            <>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatMXN(ventaSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Descuento</span>
                <span>−{formatMXN(descuento)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-sm">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-lg">{formatMXN(venta.total)}</span>
          </div>
          {venta.pago_recibido != null && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Recibido</span>
              <span>{formatMXN(venta.pago_recibido)}</span>
            </div>
          )}
          {venta.cambio != null && venta.cambio > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Cambio</span>
              <span>{formatMXN(venta.cambio)}</span>
            </div>
          )}
          {costoVenta > 0 && (
            <div className="flex justify-between text-sm border-t pt-1.5 mt-1">
              <span className="text-muted-foreground">Ganancia bruta</span>
              <span className={gananciaBruta >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-destructive'}>
                {formatMXN(gananciaBruta)}
              </span>
            </div>
          )}
        </div>
      </div>

      {venta.notas && (
        <div className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Nota: </span>
          {venta.notas}
        </div>
      )}

      {venta.estado === 'completada' && puedeAnular && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Anular devolverá las unidades al inventario.
          </p>
          <BotonAnular ventaId={venta.id} />
        </div>
      )}
    </div>
  )
}
