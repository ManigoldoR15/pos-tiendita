import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHora } from '@/lib/fecha'
import PrintButton from './print-button'

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const { data: venta } = await supabase
    .from('ventas')
    .select(`
      id, total, descuento, pago_recibido, cambio, created_at, estado, notas,
      metodos_pago(nombre),
      venta_items(
        id, cantidad, precio_unitario, subtotal,
        productos(nombre)
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
    productos: { nombre: string } | null
  }
  const items = (venta.venta_items as unknown as ItemRaw[]) ?? []
  const ventaSubtotal = items.reduce((s, i) => s + i.subtotal, 0)
  const descuento = (venta as unknown as { descuento: number }).descuento ?? 0
  const ventaId = id.slice(0, 8).toUpperCase()
  const fecha = fmtFechaHora(venta.created_at)

  return (
    <>
      {/* Botones de acción — desaparecen al imprimir */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body > div > div { padding: 0 !important; }
          .ticket-shell { box-shadow: none !important; border: none !important; max-width: 300px; margin: 0 auto; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-sm items-center justify-between gap-3">
        <Link
          href={`/ventas/${id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <PrintButton />
      </div>

      {/* Ticket — 300px = ancho estándar papel de 58mm en pantalla */}
      <div className="ticket-shell mx-auto max-w-[300px] rounded-xl border bg-white p-4 font-mono text-[12px] leading-snug text-gray-900 shadow-md dark:bg-white dark:text-gray-900">
        {/* Encabezado */}
        <div className="mb-3 text-center">
          <p className="text-[15px] font-bold uppercase tracking-widest">{negocio.nombre}</p>
          <p className="mt-0.5 text-[10px] text-gray-500">Punto de venta</p>
        </div>

        <div className="border-t border-dashed border-gray-300 my-2" />

        {/* Meta */}
        <div className="mb-2 space-y-0.5 text-[11px] text-gray-600">
          <p>Folio: {ventaId}</p>
          <p>{fecha}</p>
          <p>Pago: {metodoPago}</p>
        </div>

        <div className="border-t border-dashed border-gray-300 my-2" />

        {/* Productos */}
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-gray-500">
              <th className="py-0.5 text-left font-normal">Producto</th>
              <th className="py-0.5 text-center font-normal w-8">Cant</th>
              <th className="py-0.5 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-0.5 text-left">
                  <span className="block max-w-[140px] truncate">
                    {item.productos?.nombre ?? 'Producto'}
                  </span>
                  <span className="text-gray-500">
                    {item.cantidad} × {formatMXN(item.precio_unitario)}
                  </span>
                </td>
                <td className="py-0.5 text-center">{item.cantidad}</td>
                <td className="py-0.5 text-right font-medium">{formatMXN(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-gray-300 my-2" />

        {/* Totales */}
        <div className="space-y-0.5 text-[12px]">
          {descuento > 0 && (
            <>
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{formatMXN(ventaSubtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Descuento</span>
                <span>−{formatMXN(descuento)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-[14px] font-bold">
            <span>TOTAL</span>
            <span>{formatMXN(venta.total)}</span>
          </div>
          {venta.pago_recibido != null && (
            <div className="flex justify-between text-gray-500">
              <span>Recibido</span>
              <span>{formatMXN(venta.pago_recibido)}</span>
            </div>
          )}
          {venta.cambio != null && venta.cambio > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Cambio</span>
              <span>{formatMXN(venta.cambio)}</span>
            </div>
          )}
        </div>

        {venta.notas && (
          <>
            <div className="border-t border-dashed border-gray-300 my-2" />
            <p className="text-[10px] text-gray-500">Nota: {venta.notas}</p>
          </>
        )}

        <div className="border-t border-dashed border-gray-300 my-2" />

        <p className="text-center text-[10px] text-gray-400">
          ¡Gracias por su compra!
        </p>
      </div>
    </>
  )
}
