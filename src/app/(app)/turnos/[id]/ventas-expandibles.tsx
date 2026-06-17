'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHoraCorta } from '@/lib/fecha'

type ItemVenta = {
  id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  unidad_medida?: string
}

type Venta = {
  id: string
  created_at: string
  total: number
  metodo_pago: string | null
  es_fiado: boolean
  cliente_nombre: string | null
  items: ItemVenta[]
}

function fmtCantidad(cantidad: number, unidad?: string) {
  if (!unidad || unidad === 'pieza') {
    return cantidad % 1 === 0 ? String(cantidad) : cantidad.toLocaleString('es-MX', { maximumFractionDigits: 3 })
  }
  return `${cantidad.toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${unidad}`
}

function VentaRow({ venta }: { venta: Venta }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <tr
        className="hover:bg-muted/20 cursor-pointer transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <td className="px-4 py-3">
          {open
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
          {fmtFechaHoraCorta(venta.created_at)}
        </td>
        <td className="px-4 py-3">
          {venta.cliente_nombre
            ? <span className="text-sm font-medium">{venta.cliente_nombre}</span>
            : <span className="text-sm text-muted-foreground">Anónimo</span>
          }
          {venta.es_fiado && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              Fiado
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{venta.metodo_pago ?? '—'}</td>
        <td className="px-4 py-3 text-right font-semibold tabular-nums">
          {formatMXN(venta.total)}
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={5} className="px-4 pb-3 pt-0">
            <div className="rounded-lg border bg-muted/10 divide-y mx-4">
              {venta.items.map(it => (
                <div key={it.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-muted-foreground">{it.nombre}</span>
                  <div className="flex items-center gap-4 tabular-nums">
                    <span className="text-xs text-muted-foreground">
                      {fmtCantidad(it.cantidad, it.unidad_medida)} × {formatMXN(it.precio_unitario)}
                    </span>
                    <span className="font-medium">{formatMXN(it.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function VentasExpandibles({ ventas }: { ventas: Venta[] }) {
  if (ventas.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay ventas en este turno.
      </p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="border-b bg-muted/30">
        <tr>
          <th className="px-4 py-3 w-8" />
          <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Hora</th>
          <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Cliente</th>
          <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Método</th>
          <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {ventas.map(v => <VentaRow key={v.id} venta={v} />)}
      </tbody>
    </table>
  )
}
