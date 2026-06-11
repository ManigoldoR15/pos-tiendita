import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { eliminarGastoAction } from './actions'

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>
}) {
  const { tipo } = await searchParams
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  // Primer y último día del mes actual
  const hoy = new Date()
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]

  const supabase = await createClient()
  const { data: gastos } = await supabase
    .from('gastos')
    .select('id, monto, descripcion, fecha, es_personal, categorias_gasto(nombre)')
    .eq('negocio_id', negocio.id)
    .gte('fecha', primerDia)
    .lte('fecha', ultimoDia)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  const todos = gastos ?? []
  const totalNegocio = todos.filter((g) => !g.es_personal).reduce((s, g) => s + g.monto, 0)
  const totalPersonal = todos.filter((g) => g.es_personal).reduce((s, g) => s + g.monto, 0)

  const gastosFiltrados =
    tipo === 'negocio'
      ? todos.filter((g) => !g.es_personal)
      : tipo === 'personal'
        ? todos.filter((g) => g.es_personal)
        : todos

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gastos</h1>
        <Button asChild>
          <Link href="/gastos/nuevo">
            <Plus className="h-4 w-4" />
            Nuevo gasto
          </Link>
        </Button>
      </div>

      {/* Resumen del mes */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Gastos del negocio</p>
          <p className="mt-1 text-xl font-bold text-destructive">{formatMXN(totalNegocio)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Gastos personales</p>
          <p className="mt-1 text-xl font-bold text-orange-500">{formatMXN(totalPersonal)}</p>
        </div>
        <div className="col-span-2 rounded-xl border bg-card p-4 shadow-sm sm:col-span-1">
          <p className="text-xs text-muted-foreground">Total este mes</p>
          <p className="mt-1 text-xl font-bold">{formatMXN(totalNegocio + totalPersonal)}</p>
        </div>
      </div>

      {/* Filtro tipo */}
      <div className="mb-4 flex gap-2">
        {[
          { label: 'Todos', value: undefined },
          { label: 'Negocio', value: 'negocio' },
          { label: 'Personal', value: 'personal' },
        ].map(({ label, value }) => (
          <Link
            key={label}
            href={value ? `/gastos?tipo=${value}` : '/gastos'}
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              tipo === value || (!tipo && !value)
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent',
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Lista */}
      {gastosFiltrados.length === 0 ? (
        <div className="mt-12 text-center text-muted-foreground">
          <p className="text-lg">No hay gastos registrados este mes.</p>
          <p className="mt-1 text-sm">¡Agrega el primero!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {gastosFiltrados.map((gasto) => {
            const catNombre = (
              gasto.categorias_gasto as unknown as { nombre: string } | null
            )?.nombre ?? '—'

            const fechaDisplay = new Date(gasto.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'short',
            })

            return (
              <div
                key={gasto.id}
                className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{catNombre}</span>
                    {gasto.es_personal && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        Personal
                      </span>
                    )}
                  </div>
                  {gasto.descripcion && (
                    <p className="text-xs text-muted-foreground truncate">{gasto.descripcion}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{fechaDisplay}</span>
                <span className="font-bold text-destructive shrink-0">
                  {formatMXN(gasto.monto)}
                </span>
                <form action={eliminarGastoAction} data-action="eliminar-gasto">
                  <input type="hidden" name="id" value={gasto.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
