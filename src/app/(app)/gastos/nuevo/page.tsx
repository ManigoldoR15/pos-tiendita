import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import GastoForm from './gasto-form'
import { crearGastoAction } from '../actions'
import { hoyMX } from '@/lib/fecha'

export default async function NuevoGastoPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const { data: categorias } = await supabase
    .from('categorias_gasto')
    .select('id, nombre')
    .eq('negocio_id', negocio.id)
    .order('orden')

  const fechaHoy = hoyMX()

  return (
    <GastoForm
      action={crearGastoAction}
      categorias={categorias ?? []}
      fechaHoy={fechaHoy}
    />
  )
}
