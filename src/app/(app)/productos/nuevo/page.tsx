import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import ProductoForm from '../producto-form'
import { crearProductoAction } from '../actions'

export default async function NuevoProductoPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  const supabase = await createClient()

  const { data: categorias } = await supabase
    .from('categorias_producto')
    .select('id, nombre')
    .eq('negocio_id', negocio!.id)
    .order('nombre')

  return (
    <ProductoForm
      action={crearProductoAction}
      categorias={categorias ?? []}
      titulo="Nuevo producto"
    />
  )
}
