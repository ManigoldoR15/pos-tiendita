import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHora } from '@/lib/fecha'
import PrintButton from './print-button'

export default async function NotaRemisionPage({
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
      id, total, descuento, created_at, notas, cliente_id,
      clientes(nombre, telefono),
      venta_items(
        id, cantidad, precio_unitario, subtotal,
        productos(nombre)
      )
    `)
    .eq('id', id)
    .eq('negocio_id', negocio.id)
    .single()

  if (!venta) notFound()

  type ItemRaw = {
    id: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    productos: { nombre: string } | null
  }
  const items = (venta.venta_items as unknown as ItemRaw[]) ?? []
  const cliente = (venta.clientes as unknown as { nombre: string; telefono: string | null } | null)
  const ventaSubtotal = items.reduce((s, i) => s + i.subtotal, 0)
  const descuento = (venta as unknown as { descuento: number }).descuento ?? 0
  const noRemision = id.slice(0, 8).toUpperCase()
  const fecha = fmtFechaHora(venta.created_at)

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          body > div { padding: 0 !important; background: white !important; }
          .nota-shell {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20mm 20mm 25mm 20mm !important;
          }
        }
      `}</style>

      {/* Controles — desaparecen al imprimir */}
      <div className="no-print mx-auto mb-6 flex max-w-2xl items-center justify-between gap-3">
        <Link
          href={`/ventas/${id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la venta
        </Link>
        <PrintButton />
      </div>

      {/* Nota de remisión — media carta / carta */}
      <div className="nota-shell mx-auto max-w-2xl rounded-xl border bg-white p-8 text-gray-900 shadow-md dark:bg-white dark:text-gray-900">

        {/* Encabezado */}
        <div className="mb-6 border-b-2 border-gray-800 pb-4 text-center">
          <h1 className="text-2xl font-black uppercase tracking-widest text-gray-900">
            Nota de Remisión
          </h1>
          <p className="mt-1 text-lg font-bold text-gray-800">{negocio.nombre}</p>
        </div>

        {/* Meta — folio y fecha */}
        <div className="mb-5 flex items-start justify-between gap-4 text-sm">
          <div>
            <span className="font-semibold text-gray-600">No. Remisión:</span>{' '}
            <span className="font-bold text-gray-900">{noRemision}</span>
          </div>
          <div className="text-right">
            <span className="font-semibold text-gray-600">Fecha:</span>{' '}
            <span className="text-gray-900">{fecha}</span>
          </div>
        </div>

        {/* Datos del cliente */}
        <div className="mb-6 rounded-lg border border-gray-300 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            Datos del cliente
          </p>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <span className="font-semibold text-gray-600">Nombre:</span>{' '}
              <span className="text-gray-900">
                {cliente?.nombre ?? <span className="inline-block w-40 border-b border-gray-400" />}
              </span>
            </div>
            <div>
              <span className="font-semibold text-gray-600">Teléfono:</span>{' '}
              <span className="text-gray-900">
                {cliente?.telefono ?? <span className="inline-block w-32 border-b border-gray-400" />}
              </span>
            </div>
            <div>
              <span className="font-semibold text-gray-600">Domicilio:</span>{' '}
              <span className="inline-block w-52 border-b border-gray-400" />
            </div>
            <div>
              <span className="font-semibold text-gray-600">Ciudad:</span>{' '}
              <span className="inline-block w-36 border-b border-gray-400" />
            </div>
          </div>
        </div>

        {/* Tabla de productos */}
        <table className="mb-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-gray-800 bg-gray-100 text-left text-xs font-bold uppercase tracking-wide text-gray-700">
              <th className="py-2.5 pl-3 pr-2 text-center w-16">Cantidad</th>
              <th className="px-3 py-2.5">Artículo</th>
              <th className="px-3 py-2.5 text-right w-28">Precio</th>
              <th className="py-2.5 pl-3 pr-3 text-right w-28">Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="py-2.5 pl-3 pr-2 text-center tabular-nums text-gray-900">
                  {item.cantidad.toLocaleString('es-MX', { maximumFractionDigits: 3 })}
                </td>
                <td className="px-3 py-2.5 text-gray-900">
                  {item.productos?.nombre ?? 'Producto'}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                  {formatMXN(item.precio_unitario)}
                </td>
                <td className="py-2.5 pl-3 pr-3 text-right font-semibold tabular-nums text-gray-900">
                  {formatMXN(item.subtotal)}
                </td>
              </tr>
            ))}
            {/* Filas vacías decorativas para papel */}
            {items.length < 6 &&
              Array.from({ length: Math.max(0, 6 - items.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-gray-200">
                  <td className="py-2.5">&nbsp;</td>
                  <td className="py-2.5" />
                  <td className="py-2.5" />
                  <td className="py-2.5" />
                </tr>
              ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="mb-8 flex justify-end">
          <div className="w-56 space-y-1.5 text-sm">
            {descuento > 0 && (
              <>
                <div className="flex justify-between border-b border-dashed border-gray-300 pb-1.5">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="tabular-nums text-gray-900">{formatMXN(ventaSubtotal)}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-gray-300 pb-1.5">
                  <span className="text-gray-600">Descuento</span>
                  <span className="tabular-nums text-gray-900">−{formatMXN(descuento)}</span>
                </div>
              </>
            )}
            {descuento === 0 && (
              <div className="flex justify-between border-b border-dashed border-gray-300 pb-1.5">
                <span className="text-gray-600">Subtotal</span>
                <span className="tabular-nums text-gray-900">{formatMXN(ventaSubtotal)}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-gray-800 pt-2">
              <span className="text-base font-black uppercase text-gray-900">Total</span>
              <span className="text-base font-black tabular-nums text-gray-900">{formatMXN(venta.total)}</span>
            </div>
          </div>
        </div>

        {/* Notas de la venta */}
        {venta.notas && (
          <div className="mb-8 text-sm text-gray-600">
            <span className="font-semibold">Observaciones: </span>{venta.notas}
          </div>
        )}

        {/* Pie — firma */}
        <div className="mt-8 flex items-end justify-between gap-8 border-t border-gray-300 pt-6 text-center text-sm text-gray-600">
          <div className="flex-1">
            <div className="mb-1 border-b border-gray-500 pb-8" />
            <p>Recibí de conformidad</p>
          </div>
          <div className="flex-1">
            <div className="mb-1 border-b border-gray-500 pb-8" />
            <p>Entregó</p>
          </div>
        </div>
      </div>
    </>
  )
}
