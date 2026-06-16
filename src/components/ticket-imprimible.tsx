'use client'

import { formatMXN } from '@/lib/dinero'

export type ItemTicket = { nombre: string; cantidad: number; precio: number; fiado?: boolean }

export type DatosTicket = {
  items: ItemTicket[]
  total: number
  metodoPagoNombre: string
  cambio: number | null
  fecha: string
  totalFiado?: number
  clienteNombre?: string | null
}

type Props = {
  negocioNombre: string
  datos: DatosTicket
}

export function imprimirTicket() {
  document.body.classList.add('printing-ticket')
  function limpiar() {
    document.body.classList.remove('printing-ticket')
    window.removeEventListener('afterprint', limpiar)
  }
  window.addEventListener('afterprint', limpiar)
  window.print()
}

export default function TicketImprimible({ negocioNombre, datos }: Props) {
  const f = new Date(datos.fecha)
  const fechaTexto = f.toLocaleDateString('es-MX')
  const horaTexto = f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      id="ticket-imprimible"
      className="imprimible hidden print:block print:w-[280px] print:bg-white print:p-3 print:font-mono print:text-[11px] print:text-black"
    >
      <p className="text-center text-sm font-bold">{negocioNombre}</p>
      <p className="text-center">{fechaTexto} {horaTexto}</p>
      <div className="my-2 border-t border-dashed border-black" />
      {datos.items.map((it, i) => (
        <div key={i} className="flex justify-between gap-2">
          <span>{it.cantidad} x {it.nombre}{it.fiado ? ' (fiado)' : ''}</span>
          <span>{formatMXN(it.precio * it.cantidad)}</span>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between font-bold">
        <span>TOTAL</span>
        <span>{formatMXN(datos.total)}</span>
      </div>
      <div className="flex justify-between">
        <span>Método</span>
        <span>{datos.metodoPagoNombre}</span>
      </div>
      {datos.cambio !== null && datos.cambio > 0 && (
        <div className="flex justify-between">
          <span>Cambio</span>
          <span>{formatMXN(datos.cambio)}</span>
        </div>
      )}
      {!!datos.totalFiado && datos.totalFiado > 0 && (
        <>
          <div className="my-2 border-t border-dashed border-black" />
          <div className="flex justify-between font-bold">
            <span>QUEDÓ A DEBER</span>
            <span>{formatMXN(datos.totalFiado)}</span>
          </div>
          {datos.clienteNombre && (
            <div className="flex justify-between">
              <span>Cliente</span>
              <span>{datos.clienteNombre}</span>
            </div>
          )}
        </>
      )}
      <p className="mt-3 text-center">¡Gracias por su compra!</p>
    </div>
  )
}
