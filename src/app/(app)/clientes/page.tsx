import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users, ChevronRight, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { EstatusCliente } from '@/components/estatus-cliente'
import type { EstatusClienteValue } from '@/components/estatus-cliente'

export default async function ClientesPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, activo, en_lista_negra, estatus, estatus_nota')
    .eq('negocio_id', negocio.id)
    .eq('activo', true)
    .order('nombre')

  // Contar precios especiales por cliente
  const { data: pecCounts } = await supabase
    .from('precios_especiales_cliente')
    .select('cliente_id')
    .eq('negocio_id', negocio.id)
    .in('cliente_id', (clientes ?? []).map((c) => c.id))

  const preciosPorCliente = (pecCounts ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.cliente_id] = (acc[r.cliente_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">Clientes</h1>
            <p className="text-sm text-muted-foreground">{(clientes ?? []).length} registrados</p>
          </div>
        </div>
        <Link
          href="/clientes/nuevo"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/88 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo
        </Link>
      </div>

      {(clientes ?? []).length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">Sin clientes registrados.</p>
          <p className="text-sm text-muted-foreground">Usa el botón "Nuevo" o créalos desde el POS al cobrar.</p>
        </div>
      ) : (
        <div className="card-soft divide-y">
          {(clientes ?? []).map((c) => {
            const nEspeciales = preciosPorCliente[c.id] ?? 0
            return (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{c.nombre}</p>
                    <EstatusCliente
                      estatus={c.estatus as EstatusClienteValue}
                      nota={c.estatus_nota}
                      size="sm"
                    />
                    {c.en_lista_negra && (
                      <span className="shrink-0 text-xs font-medium text-destructive">Lista negra</span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    {c.telefono && <span>{c.telefono}</span>}
                    {nEspeciales > 0 && (
                      <span className="text-blue-600 dark:text-blue-400">
                        {nEspeciales} precio{nEspeciales !== 1 ? 's' : ''} especial{nEspeciales !== 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
