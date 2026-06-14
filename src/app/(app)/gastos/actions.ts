'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { textoCentavos } from '@/lib/dinero'
import { hoyMX } from '@/lib/fecha'

export type GastoState = { error: string } | null

export async function crearGastoAction(
  _prev: GastoState,
  formData: FormData,
): Promise<GastoState> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const categoria_id = formData.get('categoria_id') as string
  const montoTexto = (formData.get('monto') as string) ?? ''
  const descripcion = (formData.get('descripcion') as string)?.trim() || null
  const fecha = (formData.get('fecha') as string) || hoyMX()
  const es_personal = formData.get('es_personal') === 'on'

  if (!categoria_id) return { error: 'Selecciona una categoría' }

  const monto = textoCentavos(montoTexto)
  if (monto <= 0) return { error: 'El monto debe ser mayor a $0.00' }

  const supabase = await createClient()
  const { error } = await supabase.from('gastos').insert({
    negocio_id: negocio.id,
    categoria_id,
    monto,
    descripcion,
    fecha,
    es_personal,
  })

  if (error) return { error: 'No se pudo guardar. Intenta de nuevo.' }
  revalidatePath('/gastos')
  redirect('/gastos')
}

export async function eliminarGastoAction(formData: FormData): Promise<void> {
  const id = formData.get('id') as string
  const supabase = await createClient()
  await supabase.from('gastos').delete().eq('id', id)
  revalidatePath('/gastos')
}
