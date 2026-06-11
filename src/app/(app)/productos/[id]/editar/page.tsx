import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import ProductoForm from '../../producto-form'
import { editarProductoAction } from '../../actions'

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const negocio = await getNegocioActual()
  const supabase = await createClient()

  const [{ data: producto }, { data: categorias }] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, precio_venta, categoria_id, existencias, activo')
      .eq('id', id)
      .eq('negocio_id', negocio!.id)
      .single(),
    supabase
      .from('categorias_producto')
      .select('id, nombre')
      .eq('negocio_id', negocio!.id)
      .order('nombre'),
  ])

  if (!producto) notFound()

  return (
    <ProductoForm
      action={editarProductoAction}
      categorias={categorias ?? []}
      titulo="Editar producto"
      inicial={producto}
    />
  )
}
