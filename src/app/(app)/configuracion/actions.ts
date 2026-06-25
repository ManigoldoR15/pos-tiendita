'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

export type ConfigState = { error: string } | { success: string } | null

export async function actualizarNombreAction(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { error: 'El nombre no puede estar vacío' }
  if (nombre.length > 80) return { error: 'El nombre es demasiado largo' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('negocios')
    .update({ nombre })
    .eq('id', negocio.id)

  if (error) return { error: 'No se pudo guardar. Intenta de nuevo.' }

  revalidatePath('/configuracion')
  revalidatePath('/')
  return { success: 'Nombre actualizado' }
}

export async function toggleMetodoPagoAction(formData: FormData): Promise<void> {
  const id = formData.get('id') as string
  const activo = formData.get('activo') === 'true'

  const supabase = await createClient()
  await supabase.from('metodos_pago').update({ activo }).eq('id', id)

  revalidatePath('/configuracion')
  revalidatePath('/pos')
}

export async function agregarMetodoPagoAction(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { error: 'Escribe el nombre del método de pago' }
  if (nombre.length > 60) return { error: 'El nombre es demasiado largo' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { error } = await supabase.from('metodos_pago').insert({
    negocio_id: negocio.id,
    nombre,
    activo: true,
  })

  if (error) return { error: 'No se pudo agregar. Intenta de nuevo.' }

  revalidatePath('/configuracion')
  revalidatePath('/pos')
  return { success: `"${nombre}" agregado` }
}

export async function eliminarMetodoPagoAction(formData: FormData): Promise<void> {
  const id = formData.get('id') as string
  const supabase = await createClient()
  await supabase.from('metodos_pago').delete().eq('id', id)
  revalidatePath('/configuracion')
  revalidatePath('/pos')
}

export async function actualizarPerfilNegocioAction(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const tipo_negocio = (formData.get('tipo_negocio') as string) || 'tiendita'
  const ciudad = (formData.get('ciudad') as string)?.trim() || null
  const estado_mx = (formData.get('estado_mx') as string) || null
  const inscrito_sat = formData.get('inscrito_sat') === 'on'
  const rfc = (formData.get('rfc') as string)?.trim().toUpperCase() || null

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('negocios')
    .update({ tipo_negocio, ciudad, estado_mx, inscrito_sat, rfc: inscrito_sat ? rfc : null })
    .eq('id', negocio.id)

  if (error) return { error: 'No se pudo guardar. Intenta de nuevo.' }

  revalidatePath('/configuracion')
  return { success: 'Perfil actualizado' }
}
