'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

export type ProveedorState = { error?: string; ok?: boolean } | null

export async function crearProveedorAction(
  _prev: ProveedorState,
  formData: FormData,
): Promise<ProveedorState> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio activo.' }

  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const supabase = await createClient()
  const { error } = await supabase.from('proveedores').insert({
    negocio_id: negocio.id,
    nombre,
    telefono: (formData.get('telefono') as string)?.trim() || null,
    email: (formData.get('email') as string)?.trim() || null,
    notas: (formData.get('notas') as string)?.trim() || null,
  })

  if (error) return { error: 'No se pudo guardar el proveedor.' }
  revalidatePath('/proveedores')
  return { ok: true }
}

export async function actualizarProveedorAction(
  _prev: ProveedorState,
  formData: FormData,
): Promise<ProveedorState> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio activo.' }

  const id = formData.get('id') as string
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('proveedores')
    .update({
      nombre,
      telefono: (formData.get('telefono') as string)?.trim() || null,
      email: (formData.get('email') as string)?.trim() || null,
      notas: (formData.get('notas') as string)?.trim() || null,
    })
    .eq('id', id)
    .eq('negocio_id', negocio.id)

  if (error) return { error: 'No se pudo actualizar el proveedor.' }
  revalidatePath('/proveedores')
  return { ok: true }
}

export async function eliminarProveedorAction(formData: FormData): Promise<void> {
  const negocio = await getNegocioActual()
  if (!negocio) return

  const id = formData.get('id') as string
  const supabase = await createClient()
  await supabase
    .from('proveedores')
    .delete()
    .eq('id', id)
    .eq('negocio_id', negocio.id)

  revalidatePath('/proveedores')
}
