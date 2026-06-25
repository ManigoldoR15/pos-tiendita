import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { PrintButton } from '@/components/print-button'

export default async function CompraDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const { id } = await params
  const supabase = await createClient()

  const { data: compra } = await supabase
    .from('compras')
    .select(`
      id, fecha, total, notas, created_at,
      proveedores(nombre, telefono),
      compras_items(
        id, cantidad, costo_unitario, subtotal,
        productos(nombre, unidad_medida)
      )
    `)
    .eq('id', id)
    .eq('negocio_id', negocio.id)
    .single()

  if (!compra) notFound()

  type ItemRow = {
    id: string
    cantidad: number
    costo_unitario: number
    subtotal: number
    productos: { nombre: string; unidad_medida: string } | { nombre: string; unidad_medida: string }[] | null
  }
  const items = (compra.compras_items ?? []) as unknown as ItemRow[]

  const prov = Array.isArray(compra.proveedores) ? compra.proveedores[0] : compra.proveedores
  const fechaDisplay = new Date(compra.fecha + 'T12:00:00Z').toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <Link
          href="/compras"
          className="flex h-9 w-9 items-center justify-center rounded-xl border bg-card text-muted-foreground transition hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">Detalle de compra</h1>
          <p className="text-sm text-muted-foreground capitalize">{fechaDisplay}</p>
        </div>
        <PrintButton />
      </div>

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{negocio.nombre} — Entrada de mercancía</h1>
        <p className="text-sm capitalize">{fechaDisplay}</p>
      </div>

      {/* Resumen */}
      <div className="card-soft p-5 space-y-3">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Proveedor: </span>
            <span className="font-medium">{prov?.nombre ?? 'No especificado'}</span>
          </div>
          {prov?.telefono && (
            <div>
              <span className="text-muted-foreground">Teléfono: </span>
              <span className="font-medium">{prov.telefono}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Total: </span>
            <span className="font-bold text-primary text-base">{formatMXN(compra.total)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Productos: </span>
            <span className="font-medium">{items.length} líneas</span>
          </div>
        </div>
        {compra.notas && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="font-medium">Notas: </span>{compra.notas}
          </p>
        )}
      </div>

      {/* Tabla de ítems */}
      <div className="card-soft overflow-hidden">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-bold">Productos recibidos</h2>
        </div>

        <div className="divide-y">
          {items.map((item) => {
            const prod = Array.isArray(item.productos) ? item.productos[0] : item.productos
            return (
              <div
                key={item.id}
                className="flex items-center gap-4 px-5 py-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{prod?.nombre ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(item.cantidad) % 1 === 0
                      ? Number(item.cantidad).toFixed(0)
                      : Number(item.cantidad).toFixed(3)}{' '}
                    {prod?.unidad_medida ?? ''} × {formatMXN(item.costo_unitario)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{formatMXN(item.subtotal)}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Total */}
        <div className="flex justify-end border-t bg-muted/30 px-5 py-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-black text-primary">{formatMXN(compra.total)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
