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
      .select('id, nombre, precio_venta, precio_costo, categoria_id, existencias, codigo_barras, activo, unidad_medida, tara, tiene_variantes, atributo1, atributo2')
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

  const { data: variantes } = producto.tiene_variantes
    ? await supabase
        .from('variantes_producto')
        .select('valor1, valor2, existencias')
        .eq('producto_id', producto.id)
        .eq('activo', true)
        .order('valor1')
    : { data: [] }

  return (
    <ProductoForm
      action={editarProductoAction}
      categorias={categorias ?? []}
      titulo="Editar producto"
      variantesActuales={variantes ?? []}
      inicial={producto}
    />
  )
}
