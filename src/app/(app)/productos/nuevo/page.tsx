import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { hoyMX } from '@/lib/fecha'
import { seedCategoriasIfEmpty } from '../../caducidad/actions'
import ProductoForm from '../producto-form'
import { crearProductoAction } from '../actions'

export default async function NuevoProductoPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol === 'empleado') redirect('/')

  await seedCategoriasIfEmpty(negocio!.id)

  const supabase = await createClient()

  const [{ data: categorias }, { data: categoriasPerecedero }] = await Promise.all([
    supabase
      .from('categorias_producto')
      .select('id, nombre')
      .eq('negocio_id', negocio!.id)
      .order('nombre'),
    supabase
      .from('categorias_perecedero')
      .select('id, nombre, dias_refri, dias_congelador, dias_ambiente')
      .eq('negocio_id', negocio!.id)
      .order('orden')
      .order('nombre'),
  ])

  return (
    <ProductoForm
      action={crearProductoAction}
      categorias={categorias ?? []}
      categoriasPerecedero={categoriasPerecedero ?? []}
      hoy={hoyMX()}
      titulo="Nuevo producto"
    />
  )
}
