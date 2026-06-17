'use client'

import { Printer } from 'lucide-react'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHora } from '@/lib/fecha'

type TurnoHeader = {
  id: string
  apertura_email: string
  apertura_rol: string
  cierre_email: string | null
  cierre_rol: string | null
  abierto_por: string
  cerrado_por: string | null
  fecha_apertura: string
  fecha_cierre: string
  monto_inicial: number
  monto_esperado: number | null
  monto_contado: number | null
  diferencia: number | null
  duracion_min: number
  total_ventas: number
  num_ventas: number
  ventas_efectivo: number
  ventas_otros: number
  total_fiado: number
  negocioNombre: string
}

type ProductoResumen = {
  nombre: string
  unidad_medida: string
  cantidad_total: number
  total_mxn: number
}

function emailCajero(email: string | null) {
  return email ? email.split('@')[0] : '—'
}

function PrintResumen({ t }: { t: TurnoHeader }) {
  return (
    <div id="ticket-turno-resumen" className="imprimible hidden print:block font-mono text-[11px] leading-snug max-w-[280px] mx-auto">
      <div className="text-center mb-3">
        <p className="font-bold text-base">{t.negocioNombre}</p>
        <p className="font-bold">RESUMEN DE TURNO</p>
      </div>

      <div className="border-t border-dashed my-2" />

      <p>Apertura: {fmtFechaHora(t.fecha_apertura)}</p>
      <p>Cierre:   {fmtFechaHora(t.fecha_cierre)}</p>
      <p>Duración: {t.duracion_min} min</p>
      <p>Abrió:   {emailCajero(t.apertura_email)} ({t.apertura_rol})</p>
      <p>Cerró:   {emailCajero(t.cierre_email)} {t.cerrado_por !== t.abierto_por ? `(${t.cierre_rol})` : ''}</p>

      <div className="border-t border-dashed my-2" />

      <p className="flex justify-between"><span>Fondo inicial:</span><span>{formatMXN(t.monto_inicial)}</span></p>
      <p className="flex justify-between"><span>Ventas efectivo:</span><span>{formatMXN(t.ventas_efectivo)}</span></p>
      <p className="flex justify-between font-bold"><span>Esperado caja:</span><span>{formatMXN(t.monto_esperado ?? 0)}</span></p>
      <p className="flex justify-between"><span>Contado:</span><span>{formatMXN(t.monto_contado ?? 0)}</span></p>
      <p className="flex justify-between font-bold">
        <span>Diferencia:</span>
        <span>{(t.diferencia ?? 0) === 0 ? 'Sin diferencia' : `${(t.diferencia ?? 0) > 0 ? '+' : ''}${formatMXN(t.diferencia ?? 0)}`}</span>
      </p>

      <div className="border-t border-dashed my-2" />

      <p className="flex justify-between"><span>Total ventas:</span><span>{formatMXN(t.total_ventas)}</span></p>
      <p className="flex justify-between"><span>  Efectivo:</span><span>{formatMXN(t.ventas_efectivo)}</span></p>
      <p className="flex justify-between"><span>  Otros:</span><span>{formatMXN(t.ventas_otros)}</span></p>
      {t.total_fiado > 0 && (
        <p className="flex justify-between"><span>  Fiado:</span><span>{formatMXN(t.total_fiado)}</span></p>
      )}
      <p className="flex justify-between"><span># transacciones:</span><span>{t.num_ventas}</span></p>

      <div className="border-t border-dashed my-2" />
      <p className="text-center text-[10px]">Turno {t.id.slice(0, 8).toUpperCase()}</p>
    </div>
  )
}

function PrintDetallado({ t, productos }: { t: TurnoHeader; productos: ProductoResumen[] }) {
  return (
    <div id="ticket-turno-detallado" className="imprimible hidden print:block font-mono text-[11px] leading-snug max-w-[280px] mx-auto">
      <div className="text-center mb-3">
        <p className="font-bold text-base">{t.negocioNombre}</p>
        <p className="font-bold">DETALLE DE TURNO</p>
      </div>

      {/* Resumen monetario (igual que resumen) */}
      <div className="border-t border-dashed my-2" />
      <p>Apertura: {fmtFechaHora(t.fecha_apertura)}</p>
      <p>Cierre:   {fmtFechaHora(t.fecha_cierre)}</p>
      <p>Abrió:   {emailCajero(t.apertura_email)}</p>
      {t.cerrado_por !== t.abierto_por && <p>Cerró:   {emailCajero(t.cierre_email)}</p>}
      <div className="border-t border-dashed my-2" />
      <p className="flex justify-between"><span>Fondo inicial:</span><span>{formatMXN(t.monto_inicial)}</span></p>
      <p className="flex justify-between"><span>Ventas efectivo:</span><span>{formatMXN(t.ventas_efectivo)}</span></p>
      <p className="flex justify-between font-bold"><span>Esperado:</span><span>{formatMXN(t.monto_esperado ?? 0)}</span></p>
      <p className="flex justify-between"><span>Contado:</span><span>{formatMXN(t.monto_contado ?? 0)}</span></p>
      <p className="flex justify-between font-bold">
        <span>Diferencia:</span>
        <span>{(t.diferencia ?? 0) === 0 ? 'OK' : `${(t.diferencia ?? 0) > 0 ? '+' : ''}${formatMXN(t.diferencia ?? 0)}`}</span>
      </p>

      {/* Productos vendidos */}
      {productos.length > 0 && (
        <>
          <div className="border-t border-dashed my-2" />
          <p className="font-bold">PRODUCTOS VENDIDOS</p>
          <div className="border-t border-dashed my-1" />
          {productos.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span className="flex-1 truncate">{p.nombre}</span>
              <span className="ml-2">
                {p.cantidad_total.toLocaleString('es-MX', { maximumFractionDigits: 3 })}
                {p.unidad_medida !== 'pieza' ? ` ${p.unidad_medida}` : 'u'}
              </span>
              <span className="ml-2 tabular-nums">{formatMXN(p.total_mxn)}</span>
            </div>
          ))}
          <div className="border-t border-dashed my-1" />
          <p className="flex justify-between font-bold">
            <span>TOTAL VENTAS</span>
            <span>{formatMXN(t.total_ventas)}</span>
          </p>
        </>
      )}

      <div className="border-t border-dashed my-2" />
      <p className="text-center text-[10px]">Turno {t.id.slice(0, 8).toUpperCase()}</p>
    </div>
  )
}

type Props = { turno: TurnoHeader; productos: ProductoResumen[] }

export default function TicketTurno({ turno, productos }: Props) {
  function printResumen() {
    document.getElementById('ticket-turno-detallado')?.classList.add('!hidden')
    document.getElementById('ticket-turno-resumen')?.classList.remove('hidden')
    document.getElementById('ticket-turno-resumen')?.classList.add('!block')
    window.print()
    setTimeout(() => {
      document.getElementById('ticket-turno-resumen')?.classList.remove('!block')
      document.getElementById('ticket-turno-resumen')?.classList.add('hidden')
      document.getElementById('ticket-turno-detallado')?.classList.remove('!hidden')
    }, 500)
  }

  function printDetallado() {
    document.getElementById('ticket-turno-resumen')?.classList.add('!hidden')
    document.getElementById('ticket-turno-detallado')?.classList.remove('hidden')
    document.getElementById('ticket-turno-detallado')?.classList.add('!block')
    window.print()
    setTimeout(() => {
      document.getElementById('ticket-turno-detallado')?.classList.remove('!block')
      document.getElementById('ticket-turno-detallado')?.classList.add('hidden')
      document.getElementById('ticket-turno-resumen')?.classList.remove('!hidden')
    }, 500)
  }

  return (
    <>
      <div className="flex gap-2 print:hidden">
        <button
          onClick={printResumen}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Printer className="h-4 w-4" />
          Imprimir resumen
        </button>
        <button
          onClick={printDetallado}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Printer className="h-4 w-4" />
          Imprimir detallado
        </button>
      </div>

      {/* Hidden print templates */}
      <PrintResumen t={turno} />
      <PrintDetallado t={turno} productos={productos} />
    </>
  )
}
