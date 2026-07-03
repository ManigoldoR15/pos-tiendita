import Link from 'next/link'
import { redirect } from 'next/navigation'
import { HandCoins, Ban, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { requireModulo } from '@/lib/modulos'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaCorta } from '@/lib/fecha'
import { cn } from '@/lib/utils'
import Buscador from '@/components/buscador'

type Orden = 'monto' | 'antiguedad'

export default async function FiadosPage({
  searchParams,
}: {
  searchParams: Promise<{ orden?: string; vista?: string; q?: string }>
}) {
  const { orden: ordenParam, vista, q } = await searchParams
  const orden: Orden = ordenParam === 'antiguedad' ? 'antiguedad' : 'monto'
  const verListaNegra = vista === 'lista-negra'
  const busqueda = (q ?? '').trim()

  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  await requireModulo('fiados')

  const supabase = await createClient()

  const [{ data: deudores }, { data: clientesListaNegra }] = await Promise.all([
    supabase
      .from('fiados_por_cliente')
      .select('cliente_id, deuda_total, debe_desde, notas_pendientes')
      .eq('negocio_id', negocio.id),
    supabase
      .from('clientes')
      .select('id, nombre, telefono, motivo_lista_negra')
      .eq('negocio_id', negocio.id)
      .eq('en_lista_negra', true)
      .order('nombre'),
  ])

  const clienteIds = (deudores ?? []).map((d) => d.cliente_id)
  const { data: clientesInfo } = clienteIds.length
    ? await supabase
        .from('clientes')
        .select('id, nombre, telefono')
        .in('id', clienteIds)
    : { data: [] }

  const infoMap = new Map((clientesInfo ?? []).map((c) => [c.id, c]))

  type Deudor = {
    cliente_id: string
    deuda_total: number
    debe_desde: string
    notas_pendientes: number
    nombre: string
    telefono: string | null
  }

  let lista: Deudor[] = (deudores ?? []).map((d) => ({
    ...d,
    nombre: infoMap.get(d.cliente_id)?.nombre ?? 'Cliente eliminado',
    telefono: infoMap.get(d.cliente_id)?.telefono ?? null,
  }))

  lista = orden === 'monto'
    ? lista.sort((a, b) => b.deuda_total - a.deuda_total)
    : lista.sort((a, b) => new Date(a.debe_desde).getTime() - new Date(b.debe_desde).getTime())

  const totalPorCobrar = lista.reduce((s, d) => s + d.deuda_total, 0)
  const totalDeudores = lista.length

  const qLower = busqueda.toLowerCase()
  if (qLower) lista = lista.filter((d) => d.nombre.toLowerCase().includes(qLower))
  const listaNegra = qLower
    ? (clientesListaNegra ?? []).filter((c) => c.nombre.toLowerCase().includes(qLower))
    : (clientesListaNegra ?? [])

  function fiadosUrl(extra: Record<string, string>) {
    const params = new URLSearchParams(extra)
    if (busqueda) params.set('q', busqueda)
    const qs = params.toString()
    return `/fiados${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Fiados</h1>
        <div className="flex rounded-lg border p-0.5 bg-muted/40">
          <Link
            href={fiadosUrl({})}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              !verListaNegra ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Por cobrar
          </Link>
          <Link
            href={fiadosUrl({ vista: 'lista-negra' })}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              verListaNegra ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Ban className="h-3.5 w-3.5" />
            Lista negra
          </Link>
        </div>
      </div>

      <Buscador
        placeholder="Buscar cliente por nombre…"
        defaultValue={busqueda}
        baseParams={{
          ...(verListaNegra ? { vista: 'lista-negra' } : {}),
          ...(ordenParam === 'antiguedad' ? { orden: 'antiguedad' } : {}),
        }}
      />

      {verListaNegra ? (
        <div className="card-soft divide-y">
          {listaNegra.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Ban className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p>
                {busqueda
                  ? `No hay clientes en lista negra que coincidan con “${busqueda}”.`
                  : 'No hay clientes en lista negra.'}
              </p>
            </div>
          ) : (
            listaNegra.map((c) => (
              <Link
                key={c.id}
                href={`/fiados/${c.id}`}
                className="flex items-center gap-3 px-5 py-4 hover:bg-accent transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.nombre}</p>
                  {c.telefono && <p className="text-sm text-muted-foreground">{c.telefono}</p>}
                  {c.motivo_lista_negra && (
                    <p className="mt-0.5 text-xs text-destructive">{c.motivo_lista_negra}</p>
                  )}
                </div>
                <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                  Bloqueado
                </span>
              </Link>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Total por cobrar */}
          <div className="card-soft relative overflow-hidden bg-primary/[0.05] p-5 sm:p-6">
            <p className="eyebrow mb-1.5 text-[10px] sm:text-xs flex items-center gap-1.5">
              <HandCoins className="h-3.5 w-3.5" />
              Por cobrar
            </p>
            <p className="text-5xl font-black tracking-tight text-primary">
              {formatMXN(totalPorCobrar)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {totalDeudores} {totalDeudores === 1 ? 'cliente debe' : 'clientes deben'}
            </p>
          </div>

          {/* Orden */}
          {lista.length > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Ordenar por:</span>
              <Link
                href={fiadosUrl({ orden: 'monto' })}
                className={cn(
                  'rounded-full border px-4 py-1.5 font-medium transition-colors',
                  orden === 'monto' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
              >
                Monto
              </Link>
              <Link
                href={fiadosUrl({ orden: 'antiguedad' })}
                className={cn(
                  'rounded-full border px-4 py-1.5 font-medium transition-colors',
                  orden === 'antiguedad' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
              >
                Antigüedad
              </Link>
            </div>
          )}

          {/* Lista de deudores */}
          <div className="card-soft divide-y">
            {lista.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <HandCoins className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p>
                  {busqueda
                    ? `Nadie que coincida con “${busqueda}” debe.`
                    : 'No hay cuentas pendientes. ¡Todo cobrado!'}
                </p>
              </div>
            ) : (
              lista.map((d) => (
                <Link
                  key={d.cliente_id}
                  href={`/fiados/${d.cliente_id}`}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-accent transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{d.nombre}</p>
                    {d.telefono && <p className="text-sm text-muted-foreground">{d.telefono}</p>}
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Debe desde {fmtFechaCorta(d.debe_desde)} · {d.notas_pendientes} nota{d.notas_pendientes !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-xl font-black tracking-tight text-primary">
                    {formatMXN(d.deuda_total)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
