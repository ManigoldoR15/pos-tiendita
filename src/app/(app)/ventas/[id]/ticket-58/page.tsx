import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import PrintBtn58 from './print-btn'

// Trunca un nombre para que quepa en `maxCh` caracteres
function trunc(str: string, maxCh: number) {
  return str.length > maxCh ? str.slice(0, maxCh - 1) + '…' : str
}

const HR = '--------------------------------'

export default async function Ticket58Page({
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
      clientes(nombre),
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
  const clienteNombre =
    (venta.clientes as unknown as { nombre: string } | null)?.nombre ?? null

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
  const folio = id.slice(0, 8).toUpperCase()

  const ahora = new Date(venta.created_at)
  const fecha = ahora.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const hora  = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' })

  // Estilos inline para garantizar que no interfiere dark mode ni Tailwind
  const s = {
    wrap: {
      width: '219px',             // 58mm a 96dpi
      margin: '0 auto',
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '11px',
      lineHeight: '1.4',
      color: '#000',
      background: '#fff',
      padding: '6px 4px',
    } as React.CSSProperties,
    center: { textAlign: 'center' } as React.CSSProperties,
    bold:   { fontWeight: 'bold' } as React.CSSProperties,
    row:    { display: 'flex', justifyContent: 'space-between', gap: '4px' } as React.CSSProperties,
    name:   { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } as React.CSSProperties,
    price:  { whiteSpace: 'nowrap', flexShrink: 0 } as React.CSSProperties,
    hr:     { borderTop: '1px dashed #000', margin: '4px 0' } as React.CSSProperties,
    sm:     { fontSize: '10px', color: '#444' } as React.CSSProperties,
    total:  { fontSize: '13px', fontWeight: 'bold' } as React.CSSProperties,
    foot:   { textAlign: 'center', fontSize: '10px', marginTop: '6px' } as React.CSSProperties,
  }

  return (
    <>
      {/* ── CSS de impresión ─────────────────────────────────────────── */}
      <style>{`
        @page {
          size: 58mm auto;
          margin: 2mm 2mm;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: 58mm;
          }
          .no-print { display: none !important; }
          /* Ocultar chrome de Next.js */
          header, nav, footer { display: none !important; }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .t58 {
            width: 54mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* ── Controles (no se imprimen) ───────────────────────────────── */}
      <div className="no-print mx-auto mb-4 flex max-w-xs items-center justify-between gap-3">
        <Link
          href={`/ventas/${id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/ventas/${id}/ticket`}
            className="rounded-lg border px-3 py-2 text-xs text-muted-foreground hover:bg-accent transition-colors"
          >
            Ticket estándar
          </Link>
          <PrintBtn58 />
        </div>
      </div>

      {/* ── Nota de ayuda ────────────────────────────────────────────── */}
      <p className="no-print mx-auto mb-4 max-w-xs text-center text-xs text-muted-foreground">
        Vista previa de ticket 58mm · Al imprimir selecciona tu impresora térmica
      </p>

      {/* ── Ticket 58mm ─────────────────────────────────────────────── */}
      <div className="t58 mx-auto rounded-md border border-dashed border-gray-300 shadow-sm dark:border-gray-600" style={s.wrap}>

        {/* Encabezado */}
        <p style={{ ...s.center, ...s.bold, fontSize: '13px', marginBottom: '2px' }}>
          {trunc(negocio.nombre.toUpperCase(), 28)}
        </p>
        <p style={{ ...s.center, ...s.sm }}>{fecha} {hora}</p>
        <p style={{ ...s.center, ...s.sm }}>Folio: {folio}</p>

        <hr style={s.hr} />

        {/* Productos */}
        {items.map((item) => {
          const nombre = item.productos?.nombre ?? 'Producto'
          return (
            <div key={item.id}>
              <div style={s.row}>
                <span style={s.name}>{trunc(nombre, 22)}</span>
                <span style={{ ...s.price, ...s.sm }}>{formatMXN(item.subtotal)}</span>
              </div>
              <div style={{ ...s.sm, paddingLeft: '4px', marginTop: '-1px' }}>
                {item.cantidad} × {formatMXN(item.precio_unitario)}
              </div>
            </div>
          )
        })}

        <hr style={s.hr} />

        {/* Totales */}
        {descuento > 0 && (
          <>
            <div style={{ ...s.row, ...s.sm }}>
              <span>Subtotal</span>
              <span>{formatMXN(ventaSubtotal)}</span>
            </div>
            <div style={{ ...s.row, ...s.sm }}>
              <span>Descuento</span>
              <span>-{formatMXN(descuento)}</span>
            </div>
          </>
        )}

        <div style={{ ...s.row, ...s.total }}>
          <span>TOTAL</span>
          <span>{formatMXN(venta.total)}</span>
        </div>

        <div style={{ ...s.row, ...s.sm, marginTop: '2px' }}>
          <span>Pago</span>
          <span>{metodoPago}</span>
        </div>

        {venta.pago_recibido != null && venta.pago_recibido > 0 && (
          <div style={{ ...s.row, ...s.sm }}>
            <span>Recibido</span>
            <span>{formatMXN(venta.pago_recibido)}</span>
          </div>
        )}

        {venta.cambio != null && venta.cambio > 0 && (
          <div style={{ ...s.row, ...s.sm }}>
            <span>Cambio</span>
            <span>{formatMXN(venta.cambio)}</span>
          </div>
        )}

        {clienteNombre && (
          <div style={{ ...s.row, ...s.sm }}>
            <span>Cliente</span>
            <span>{trunc(clienteNombre, 16)}</span>
          </div>
        )}

        {venta.notas && (
          <>
            <hr style={s.hr} />
            <p style={s.sm}>Nota: {trunc(venta.notas, 28)}</p>
          </>
        )}

        <hr style={s.hr} />

        <p style={s.foot}>¡Gracias por su compra!</p>
      </div>
    </>
  )
}
