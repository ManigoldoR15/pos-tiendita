import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { getRango, PERIODOS, type Periodo } from '@/lib/periodo'
import { PrintButton } from '@/components/print-button'

export default async function ReporteVentasPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string }>
}) {
  const { p = 'mes', desde, hasta } = await searchParams
  const periodo = p as Periodo

  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rango = getRango(periodo, desde, hasta)
  const periodoLabel = PERIODOS.find((x) => x.value === periodo)?.label ?? periodo

  const supabase = await createClient()

  const { data: ventas } = await supabase
    .from('ventas')
    .select(`
      id, total, pago_recibido, created_at, estado,
      metodos_pago(nombre),
      venta_items(cantidad, precio_unitario, productos(nombre))
    `)
    .eq('negocio_id', negocio.id)
    .gte('created_at', rango.start)
    .lte('created_at', rango.end)
    .order('created_at', { ascending: true })

  const lista = ventas ?? []
  const completadas = lista.filter((v) => v.estado === 'completada')
  const totalRecaudado = completadas.reduce((s, v) => s + v.total, 0)
  const numVentas = completadas.length
  const ticketPromedio = numVentas > 0 ? Math.round(totalRecaudado / numVentas) : 0

  // Agrupar por método de pago
  type MetodoAcc = Record<string, number>
  const porMetodo: MetodoAcc = {}
  for (const v of completadas) {
    const m = (v.metodos_pago as unknown as { nombre: string } | null)?.nombre ?? 'Otro'
    porMetodo[m] = (porMetodo[m] ?? 0) + v.total
  }

  // Top productos
  type ItemRaw = {
    cantidad: number
    precio_unitario: number
    productos: { nombre: string } | null
  }
  type ProdAcc = Record<string, { unidades: number; monto: number }>
  const topProds: ProdAcc = {}
  for (const v of completadas) {
    for (const item of (v.venta_items as unknown as ItemRaw[]) ?? []) {
      const nombre = item.productos?.nombre ?? 'Desconocido'
      if (!topProds[nombre]) topProds[nombre] = { unidades: 0, monto: 0 }
      topProds[nombre].unidades += item.cantidad
      topProds[nombre].monto += item.cantidad * item.precio_unitario
    }
  }
  const topOrdenado = Object.entries(topProds)
    .sort((a, b) => b[1].monto - a[1].monto)
    .slice(0, 10)

  const fechaGenerado = new Date().toLocaleString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="mx-auto max-w-2xl">
      {/* Controles — ocultos al imprimir */}
      <div className="print:hidden mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/ventas"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Historial
        </Link>

        {/* Selector de periodo */}
        <div className="flex gap-2 flex-wrap">
          {PERIODOS.filter((x) => x.value !== 'rango').map(({ label, value }) => (
            <Link
              key={value}
              href={`/ventas/reporte?p=${value}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                periodo === value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            href={`/ventas/reporte?p=rango&desde=${rango.startDate}&hasta=${rango.endDate}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              periodo === 'rango' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
            }`}
          >
            Rango
          </Link>
        </div>

        <PrintButton />
      </div>

      {/* ── Encabezado ── */}
      <div className="text-center mb-6 space-y-1">
        <h1 className="text-2xl font-bold">{negocio.nombre}</h1>
        <p className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
          Reporte de Ventas — {periodoLabel}
        </p>
        <p className="text-xs text-muted-foreground">{rango.startDate} al {rango.endDate}</p>
        <p className="text-xs text-muted-foreground print:block hidden">Generado: {fechaGenerado}</p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">Total recaudado</p>
          <p className="mt-1 text-lg font-bold text-green-600">{formatMXN(totalRecaudado)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">Ventas</p>
          <p className="mt-1 text-lg font-bold">{numVentas}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">Ticket promedio</p>
          <p className="mt-1 text-lg font-bold">{formatMXN(ticketPromedio)}</p>
        </div>
      </div>

      {/* ── Por método de pago ── */}
      {Object.keys(porMetodo).length > 0 && (
        <div className="rounded-xl border bg-card p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3">Por método de pago</h2>
          <div className="space-y-2">
            {Object.entries(porMetodo)
              .sort((a, b) => b[1] - a[1])
              .map(([nombre, total]) => (
                <div key={nombre} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{nombre}</span>
                  <span className="font-semibold">{formatMXN(total)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Top productos ── */}
      {topOrdenado.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden mb-4">
          <h2 className="font-semibold text-sm px-4 py-3 border-b">Top productos</h2>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Producto</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Unidades</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {topOrdenado.map(([nombre, { unidades, monto }]) => (
                <tr key={nombre}>
                  <td className="px-4 py-2 font-medium">{nombre}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{unidades}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatMXN(monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tabla de ventas ── */}
      {lista.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden mb-4">
          <h2 className="font-semibold text-sm px-4 py-3 border-b">
            Detalle de ventas ({numVentas})
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fecha/Hora</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Método</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((v) => {
                const metodo =
                  (v.metodos_pago as unknown as { nombre: string } | null)?.nombre ?? '—'
                const dt = new Date(v.created_at)
                const label = dt.toLocaleString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                return (
                  <tr key={v.id} className={v.estado === 'cancelada' ? 'opacity-40' : ''}>
                    <td className="px-4 py-2 text-muted-foreground">{label}</td>
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
                  {formatMXN(totalRecaudado)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {lista.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Sin ventas en este periodo.
        </div>
      )}
    </div>
  )
}
