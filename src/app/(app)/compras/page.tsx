import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ShoppingBag, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { formatMXN } from '@/lib/dinero'
import { hoyMX } from '@/lib/fecha'
import { cn } from '@/lib/utils'

const PERIODOS = ['hoy', 'semana', 'mes'] as const
type Periodo = (typeof PERIODOS)[number]

function getRango(periodo: Periodo, hoy: string): { desde: string; hasta: string } {
  if (periodo === 'hoy') return { desde: hoy, hasta: hoy }
  if (periodo === 'semana') {
    const d = new Date(hoy + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - 6)
    return { desde: d.toISOString().slice(0, 10), hasta: hoy }
  }
  return { desde: hoy.slice(0, 7) + '-01', hasta: hoy }
}

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol === 'empleado') redirect('/')

  const params = await searchParams
  const periodo = (PERIODOS.includes(params.periodo as Periodo) ? params.periodo : 'mes') as Periodo

  const hoy = hoyMX()
  const { desde, hasta } = getRango(periodo, hoy)

  const supabase = await createClient()
  const { data: compras } = await supabase
    .from('compras')
    .select(`
      id, fecha, total, notas, created_at,
      proveedores(nombre)
    `)
    .eq('negocio_id', negocio.id)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  const totalPeriodo = (compras ?? []).reduce((s, c) => s + c.total, 0)

  const labelPeriodo: Record<Periodo, string> = {
    hoy: 'Hoy',
    semana: 'Últimos 7 días',
    mes: 'Este mes',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Compras</h1>
          <p className="text-sm text-muted-foreground">Entradas de mercancía</p>
        </div>
        <Link
          href="/compras/nueva"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Registrar entrada
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p}
            href={`/compras?periodo=${p}`}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              periodo === p
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-accent',
            )}
          >
            {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
          </Link>
        ))}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card-soft p-5">
          <p className="eyebrow mb-1.5 text-[10px] sm:text-xs">{labelPeriodo[periodo]}</p>
          <p className="text-2xl font-black tracking-tight">{formatMXN(totalPeriodo)}</p>
          <p className="mt-1 text-xs text-muted-foreground">total en compras</p>
        </div>
        <div className="card-soft p-5">
          <p className="eyebrow mb-1.5 text-[10px] sm:text-xs">Entradas</p>
          <p className="text-2xl font-black tracking-tight">{(compras ?? []).length}</p>
          <p className="mt-1 text-xs text-muted-foreground">registros en el periodo</p>
        </div>
      </div>

      {/* Lista */}
      {(compras ?? []).length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 py-16 text-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">Sin compras registradas en este periodo.</p>
          <Link
            href="/compras/nueva"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Registrar primera entrada
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {(compras ?? []).map((c) => {
            const prov = Array.isArray(c.proveedores) ? c.proveedores[0] : c.proveedores
            return (
              <Link
                key={c.id}
                href={`/compras/${c.id}`}
                className="card-soft flex items-center gap-4 p-4 transition hover:bg-accent/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {prov?.nombre ?? 'Proveedor no especificado'}
                  </p>
                  {c.notas && (
                    <p className="truncate text-xs text-muted-foreground">{c.notas}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-black tracking-tight text-primary">{formatMXN(c.total)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.fecha + 'T12:00:00Z').toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
