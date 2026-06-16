'use client'

import { useEffect } from 'react'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaCorta, fmtFechaHoraCorta } from '@/lib/fecha'

type NotaImprimible = {
  fecha: string
  items: { nombre: string; cantidad: number; precio_unitario: number }[]
  montoFiado: number
  montoAbonado: number
  deuda: number
}

type AbonoImprimible = {
  fecha: string
  monto: number
  notas: string | null | undefined
}

type Props = {
  negocioNombre: string
  cliente: { nombre: string; telefono: string | null }
  notas: NotaImprimible[]
  abonos: AbonoImprimible[]
  deudaTotal: number
}

export default function EstadoCuentaImprimible({ negocioNombre, cliente, notas, abonos, deudaTotal }: Props) {
  useEffect(() => {
    const btn = document.getElementById('btn-imprimir-estado')
    if (!btn) return
    function handler() {
      document.body.classList.add('printing-ticket')
      function limpiar() {
        document.body.classList.remove('printing-ticket')
        window.removeEventListener('afterprint', limpiar)
      }
      window.addEventListener('afterprint', limpiar)
      window.print()
    }
    btn.addEventListener('click', handler)
    return () => btn.removeEventListener('click', handler)
  }, [])

  const hoy = new Date().toLocaleDateString('es-MX')

  return (
    <div
      id="estado-cuenta-imprimible"
      className="imprimible hidden print:block print:w-[280px] print:bg-white print:p-3 print:font-mono print:text-[11px] print:text-black"
    >
      <p className="text-center text-sm font-bold">{negocioNombre}</p>
      <p className="text-center text-xs">Estado de cuenta</p>
      <p className="text-center text-xs">{hoy}</p>
      <div className="my-2 border-t border-dashed border-black" />
      <p className="font-bold">{cliente.nombre}</p>
      {cliente.telefono && <p>{cliente.telefono}</p>}
      <div className="my-2 border-t border-dashed border-black" />

      {notas.filter((n) => n.deuda > 0).map((n, i) => (
        <div key={i} className="mb-3">
          <p className="font-bold">Nota {fmtFechaCorta(n.fecha)}</p>
          {n.items.map((it, j) => (
            <p key={j}>{it.cantidad} x {it.nombre}</p>
          ))}
          <p>Fiado: {formatMXN(n.montoFiado)}</p>
          {n.montoAbonado > 0 && <p>Abonado: -{formatMXN(n.montoAbonado)}</p>}
          <p className="font-bold">Resta: {formatMXN(Math.max(0, n.deuda))}</p>
        </div>
      ))}

      {abonos.length > 0 && (
        <>
          <div className="my-2 border-t border-dashed border-black" />
          <p className="font-bold">Abonos recientes</p>
          {abonos.slice(0, 5).map((ab, i) => (
            <div key={i} className="flex justify-between">
              <span>{fmtFechaHoraCorta(ab.fecha)}</span>
              <span>+{formatMXN(ab.monto)}</span>
            </div>
          ))}
        </>
      )}

      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between font-bold">
        <span>TOTAL DEUDA</span>
        <span>{formatMXN(deudaTotal)}</span>
      </div>
      <p className="mt-3 text-center">Gracias por su preferencia</p>
    </div>
  )
}
