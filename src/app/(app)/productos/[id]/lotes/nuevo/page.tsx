import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { hoyMX } from '@/lib/fecha'
import { agregarLoteAction } from '../../../actions'
import ReabastoForm from './reabasto-form'

export default async function NuevoLoteProductoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  const supabase = await createClient()

  const [{ data: producto }, { data: categoriasPerecedero }] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, tipo_caducidad, existencias, unidad_medida')
      .eq('id', id)
      .eq('negocio_id', negocio!.id)
      .single(),
    supabase
      .from('categorias_perecedero')
      .select('id, nombre, dias_refri, dias_congelador, dias_ambiente')
      .eq('negocio_id', negocio!.id)
      .order('orden')
      .order('nombre'),
  ])

  if (!producto) notFound()

  return (
    <ReabastoForm
      action={agregarLoteAction}
      producto={producto}
      categoriasPerecedero={categoriasPerecedero ?? []}
      hoy={hoyMX()}
    />
  )
}
