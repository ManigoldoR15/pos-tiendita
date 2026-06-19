import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import ListaItemsManager from './lista-items-manager'

export default async function ListaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol === 'empleado') redirect('/')

  const { id } = await params
  const supabase = await createClient()

  const [{ data: lista }, { data: productos }] = await Promise.all([
    supabase
      .from('listas_precio')
      .select(`
        id, nombre, descripcion, activo,
        lista_precio_items(id, producto_id, precio)
      `)
      .eq('id', id)
      .eq('negocio_id', negocio.id)
      .single(),
    supabase
      .from('productos')
      .select('id, nombre, precio_venta, unidad_medida')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
  ])

  if (!lista) notFound()

  type ItemRow = { id: string; producto_id: string; precio: number }
  const items = (lista.lista_precio_items ?? []) as unknown as ItemRow[]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/listas-precio"
          className="flex h-9 w-9 items-center justify-center rounded-xl border bg-card text-muted-foreground transition hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight">{lista.nombre}</h1>
          {lista.descripcion && (
            <p className="text-sm text-muted-foreground">{lista.descripcion}</p>
          )}
        </div>
        {!lista.activo && (
          <span className="ml-auto rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            inactiva
          </span>
        )}
      </div>

      <ListaItemsManager
        listaId={lista.id}
        listaNombre={lista.nombre}
        productos={productos ?? []}
        itemsActuales={items}
      />
    </div>
  )
}
