import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { formatMXN } from '@/lib/dinero'
import { getRango, PERIODOS, type Periodo } from '@/lib/periodo'
import { fmtFechaCorta, fmtFechaHoraCorta } from '@/lib/fecha'
import { PrintButton } from '@/components/print-button'

type GastoRow = {
  id: string
  monto: number
  descripcion: string | null
  fecha: string
  es_personal: boolean
  categorias_gasto: { nombre: string } | null
}

export default async function ReporteGastosPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string; tipo?: string }>
}) {
  const { p = 'mes', desde, hasta, tipo = 'negocio' } = await searchParams
  const periodo = p as Periodo

  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol === 'empleado') redirect('/')

  const puedeVerPersonal = !rol || rol === 'dueno'

  const rango = getRango(periodo, desde, hasta)
  const periodoLabel = PERIODOS.find((x) => x.value === periodo)?.label ?? periodo

  const supabase = await createClient()

  const { data: gastos } = await supabase
    .from('gastos')
    .select('id, monto, descripcion, fecha, es_personal, categorias_gasto(nombre)')
    .eq('negocio_id', negocio.id)
    .gte('fecha', rango.startDate)
    .lte('fecha', rango.endDate)
    .order('fecha', { ascending: false })

  const todos = (gastos ?? []) as unknown as GastoRow[]

  const gastoNegocio = todos.filter((g) => !g.es_personal)
  const gastoPersonal = todos.filter((g) => g.es_personal)

  const mostrarPersonal = puedeVerPersonal && (tipo === 'todos' || tipo === 'personal')
  const mostrarNegocio = tipo !== 'personal'

  const lista = tipo === 'todos'
    ? todos
    : tipo === 'personal'
    ? gastoPersonal
    : gastoNegocio

  const totalNegocio = gastoNegocio.reduce((s, g) => s + g.monto, 0)
  const totalPersonal = gastoPersonal.reduce((s, g) => s + g.monto, 0)
  const totalMostrado = lista.reduce((s, g) => s + g.monto, 0)

  // Agrupar por categoría
  type CatAcc = Record<string, number>
  const porCategoria: CatAcc = {}
  for (const g of lista) {
    const cat = g.categorias_gasto?.nombre ?? 'Sin categoría'
    porCategoria[cat] = (porCategoria[cat] ?? 0) + g.monto
  }
  const catOrdenada = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])

  const fechaGenerado = fmtFechaHoraCorta(new Date().toISOString())

  function tipoUrl(t: string) {
    const params = new URLSearchParams({ p: periodo, tipo: t })
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    return `/reportes/gastos?${params.toString()}`
  }

  function periodoUrl(v: string) {
    const params = new URLSearchParams({ p: v, tipo })
    return `/reportes/gastos?${params.toString()}`
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Controles — ocultos al imprimir */}
      <div className="print:hidden mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/reportes"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Reportes
        </Link>

        {/* Período */}
        <div className="flex gap-2 flex-wrap">
          {PERIODOS.filter((x) => x.value !== 'rango').map(({ label, value }) => (
            <Link
              key={value}
              href={periodoUrl(value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                periodo === value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Filtro personal/negocio — solo dueño */}
        {puedeVerPersonal && (
          <div className="flex gap-2">
            {[
              { label: 'Negocio', value: 'negocio' },
              { label: 'Personal', value: 'personal' },
              { label: 'Todos', value: 'todos' },
            ].map(({ label, value }) => (
              <Link
                key={value}
                href={tipoUrl(value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  tipo === value ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        )}

        <PrintButton />
      </div>

      {/* ── Encabezado ── */}
      <div className="text-center mb-6 space-y-1">
        <h1 className="text-2xl font-bold">{negocio.nombre}</h1>
        <p className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
          Reporte de Gastos — {periodoLabel}
          {tipo === 'personal' ? ' (Personales)' : tipo === 'todos' ? ' (Todos)' : ' (Negocio)'}
        </p>
        <p className="text-xs text-muted-foreground">{rango.startDate} al {rango.endDate}</p>
        <p className="text-xs text-muted-foreground print:block hidden">Generado: {fechaGenerado}</p>
      </div>

      {/* ── KPIs ── */}
      <div className={`grid gap-3 mb-6 ${puedeVerPersonal && tipo === 'todos' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">Total negocio</p>
          <p className="mt-1 text-lg font-bold text-red-500">{formatMXN(totalNegocio)}</p>
        </div>
        {puedeVerPersonal && tipo === 'todos' && (
          <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
            <p className="text-xs text-muted-foreground">Total personal</p>
            <p className="mt-1 text-lg font-bold text-orange-500">{formatMXN(totalPersonal)}</p>
          </div>
        )}
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">
            {tipo === 'todos' ? 'Total combinado' : 'Registros'}
          </p>
          <p className="mt-1 text-lg font-bold">
            {tipo === 'todos' ? formatMXN(totalMostrado) : lista.length}
          </p>
        </div>
      </div>

      {/* ── Por categoría ── */}
      {catOrdenada.length > 0 && (
        <div className="rounded-xl border bg-card p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3">Por categoría</h2>
          <div className="space-y-2">
            {catOrdenada.map(([nombre, monto]) => {
              const pct = totalMostrado > 0 ? Math.round((monto / totalMostrado) * 100) : 0
              return (
                <div key={nombre}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{nombre}</span>
                    <span className="font-semibold">
                      {formatMXN(monto)}{' '}
                      <span className="text-xs text-muted-foreground">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tabla de gastos ── */}
      {lista.length > 0 ? (
        <div className="rounded-xl border bg-card overflow-hidden mb-4">
          <h2 className="font-semibold text-sm px-4 py-3 border-b">
            Detalle de gastos ({lista.length})
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Categoría</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden print:table-cell sm:table-cell">Descripción</th>
                {puedeVerPersonal && tipo === 'todos' && (
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Tipo</th>
                )}
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {fmtFechaCorta(g.fecha)}
                  </td>
                  <td className="px-3 py-2">{g.categorias_gasto?.nombre ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground hidden print:table-cell sm:table-cell">
                    {g.descripcion || '—'}
                  </td>
                  {puedeVerPersonal && tipo === 'todos' && (
                    <td className="px-3 py-2 text-center text-xs">
                      {g.es_personal ? (
                        <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5">Personal</span>
                      ) : (
                        <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">Negocio</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2 text-right font-semibold">{formatMXN(g.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/30">
              <tr>
                <td className="px-4 py-2 font-semibold" colSpan={puedeVerPersonal && tipo === 'todos' ? 4 : 3}>
                  Total
                </td>
                <td className="px-4 py-2 text-right font-bold text-red-500">
                  {formatMXN(totalMostrado)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Sin gastos en este período.
        </div>
      )}
    </div>
  )
}
