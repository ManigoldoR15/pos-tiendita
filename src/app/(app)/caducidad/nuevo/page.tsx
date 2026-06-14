import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { hoyMX } from '@/lib/fecha'
import { registrarLoteAction, seedCategoriasIfEmpty } from '../actions'
import LoteForm from './lote-form'

export default async function NuevoLotePage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  await seedCategoriasIfEmpty(negocio.id)

  const supabase = await createClient()
  const [{ data: productos }, { data: categorias }] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, tipo_caducidad')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('categorias_perecedero')
      .select('id, nombre, dias_refri, dias_congelador, dias_ambiente')
      .eq('negocio_id', negocio.id)
      .order('orden')
      .order('nombre'),
  ])

  return (
    <LoteForm
      action={registrarLoteAction}
      productos={productos ?? []}
      categorias={categorias ?? []}
      hoy={hoyMX()}
    />
  )
}
