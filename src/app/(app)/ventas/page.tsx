import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Printer, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { getRango, PERIODOS, type Periodo } from '@/lib/periodo'
import { fmtHora, fmtFechaCorta } from '@/lib/fecha'
import { cn } from '@/lib/utils'

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string }>
}) {
  const { p = 'hoy', desde, hasta } = await searchParams
  const periodo = p as Periodo

  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rango = getRango(periodo, desde, hasta)
  const supabase = await createClient()

  const { data: ventas } = await supabase
    .from('ventas')
    .select('id, total, pago_recibido, cambio, created_at, estado, metodos_pago(nombre)')
    .eq('negocio_id', negocio.id)
    .gte('created_at', rango.start)
    .lte('created_at', rango.end)
    .order('created_at', { ascending: false })

  const lista = ventas ?? []
  const totalRecaudado = lista
    .filter((v) => v.estado === 'completada')
    .reduce((s, v) => s + v.total, 0)
  const numVentas = lista.filter((v) => v.estado === 'completada').length

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Historial de ventas</h1>

      {/* Cabecera con botones reporte / exportar */}
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href="/api/export/ventas"
          className="ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4" />
          Excel
        </a>
        <Link
          href={`/ventas/reporte?p=${periodo}${desde ? `&desde=${desde}` : ''}${hasta ? `&hasta=${hasta}` : ''}`}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </Link>
      </div>

      {/* Filtro periodo */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map(({ label, value }) => (
          <Link
            key={value}
            href={`/ventas?p=${value}`}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              periodo === value
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent',
            )}
          >
            {label}
          </Link>
        ))}

        {periodo === 'rango' && (
          <form method="GET" action="/ventas" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="p" value="rango" />
            <input
              name="desde"
              type="date"
              defaultValue={desde ?? rango.startDate}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">—</span>
            <input
              name="hasta"
              type="date"
              defaultValue={hasta ?? rango.endDate}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Aplicar
            </button>
          </form>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total recaudado</p>
          <p className="mt-1 text-xl font-bold text-green-600">{formatMXN(totalRecaudado)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Ventas</p>
          <p className="mt-1 text-xl font-bold">{numVentas}</p>
        </div>
        {numVentas > 0 && (
          <div className="col-span-2 rounded-xl border bg-card p-4 shadow-sm sm:col-span-1">
            <p className="text-xs text-muted-foreground">Ticket promedio</p>
            <p className="mt-1 text-xl font-bold">
              {formatMXN(Math.round(totalRecaudado / numVentas))}
            </p>
          </div>
        )}
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <div className="mt-12 text-center text-muted-foreground">
          <p className="text-lg">Sin ventas en este periodo.</p>
          <Link
            href="/pos"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            Ir al POS →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((venta) => {
            const metodoPago =
              (venta.metodos_pago as unknown as { nombre: string } | null)?.nombre ?? '—'
            const hora = fmtHora(venta.created_at)
            const fecha = fmtFechaCorta(venta.created_at)

            return (
              <Link
                key={venta.id}
                href={`/ventas/${venta.id}`}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-accent',
                  venta.estado === 'cancelada' && 'opacity-50',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{hora}</span>
                    <span className="text-xs text-muted-foreground">{fecha}</span>
                    {venta.estado === 'cancelada' && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        Cancelada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{metodoPago}</p>
                </div>
                <span className="font-bold text-green-600 shrink-0">
                  {formatMXN(venta.total)}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
