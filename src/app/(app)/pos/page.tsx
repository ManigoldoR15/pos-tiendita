import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import PosClient from './pos-client'
import { getMuestreoActivoAction } from '@/app/(app)/muestreo/actions'

export default async function PosPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const [{ data: productos }, { data: categorias }, { data: metodosPago }, { data: listasRaw }, muestreoActivo] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, precio_venta, precio_costo, existencias, categoria_id, codigo_barras, unidad_medida, tiene_variantes, atributo1, atributo2, variantes:variantes_producto(id, valor1, valor2, existencias, codigo_barras)')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('categorias_producto')
      .select('id, nombre, color')
      .eq('negocio_id', negocio.id)
      .order('nombre'),
    supabase
      .from('metodos_pago')
      .select('id, nombre')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('listas_precio')
      .select('id, nombre, lista_precio_items(producto_id, precio)')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
    getMuestreoActivoAction(),
  ])

  type ListaItem = { producto_id: string; precio: number }
  type Lista = { id: string; nombre: string; items: Record<string, number> }
  const listas: Lista[] = (listasRaw ?? []).map((l) => ({
    id: l.id,
    nombre: l.nombre,
    items: Object.fromEntries(
      ((l.lista_precio_items ?? []) as unknown as ListaItem[]).map((i) => [i.producto_id, i.precio]),
    ),
  }))

  return (
    <PosClient
      productos={productos ?? []}
      categorias={categorias ?? []}
      metodosPago={metodosPago ?? []}
      negocioNombre={negocio.nombre}
      listas={listas}
      muestreoPeriodoId={muestreoActivo?.id ?? null}
    />
  )
}
