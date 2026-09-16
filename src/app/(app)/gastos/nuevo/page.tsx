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
  const [{ data: categorias }, { data: metodosPago }] = await Promise.all([
    supabase
      .from('categorias_gasto')
      .select('id, nombre')
      .eq('negocio_id', negocio.id)
      .order('orden'),
    // Un gasto pagado en efectivo sale del cajón: sin esto el corte no lo resta
    supabase
      .from('metodos_pago')
      .select('id, nombre')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
  ])

  const fechaHoy = hoyMX()

  return (
    <GastoForm
      action={crearGastoAction}
      categorias={categorias ?? []}
      metodosPago={metodosPago ?? []}
      fechaHoy={fechaHoy}
    />
  )
}
