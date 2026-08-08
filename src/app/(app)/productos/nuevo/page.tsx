import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { getModulos } from '@/lib/modulos'
import { hoyMX } from '@/lib/fecha'
import { seedCategoriasIfEmpty } from '../../caducidad/actions'
import ProductoForm from '../producto-form'
import { crearProductoAction } from '../actions'

export default async function NuevoProductoPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  const modulos = await getModulos()
  if (rol === 'empleado') redirect('/')

  await seedCategoriasIfEmpty(negocio!.id)

  const supabase = await createClient()

  const [{ data: categorias }, { data: categoriasPerecedero }, { data: plazas }] = await Promise.all([
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
    supabase
      .from('locales')
      .select('id, nombre')
      .eq('negocio_id', negocio!.id)
      .eq('activo', true)
      .order('nombre'),
  ])

  return (
    <ProductoForm
      action={crearProductoAction}
      categorias={categorias ?? []}
      categoriasPerecedero={categoriasPerecedero ?? []}
      plazas={plazas ?? []}
      moduloVariantes={modulos.variantes}
      hoy={hoyMX()}
      titulo="Nuevo producto"
    />
  )
}
