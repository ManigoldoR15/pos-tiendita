'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { textoCentavos } from '@/lib/dinero'

async function getCtx() {
  const negocio = await getNegocioActual()
  if (!negocio) throw new Error('Negocio no encontrado')
  const rol = await getRolActual()
  if (rol === 'empleado') throw new Error('Sin permiso')
  const supabase = await createClient()
  return { negocio, supabase }
}

export async function crearListaAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const nombre = (formData.get('nombre') as string)?.trim()
  const descripcion = (formData.get('descripcion') as string)?.trim() || null
  if (!nombre) return 'El nombre es obligatorio.'

  try {
    const { negocio, supabase } = await getCtx()
    const { error } = await supabase
      .from('listas_precio')
      .insert({ negocio_id: negocio.id, nombre, descripcion })
    if (error) return error.message
  } catch (e: unknown) {
    return e instanceof Error ? e.message : 'Error al crear.'
  }

  revalidatePath('/listas-precio')
  return null
}

export async function actualizarListaAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const id = formData.get('id') as string
  const nombre = (formData.get('nombre') as string)?.trim()
  const descripcion = (formData.get('descripcion') as string)?.trim() || null
  if (!nombre) return 'El nombre es obligatorio.'

  try {
    const { negocio, supabase } = await getCtx()
    const { error } = await supabase
      .from('listas_precio')
      .update({ nombre, descripcion })
      .eq('id', id)
      .eq('negocio_id', negocio.id)
    if (error) return error.message
  } catch (e: unknown) {
    return e instanceof Error ? e.message : 'Error al actualizar.'
  }

  revalidatePath('/listas-precio')
  revalidatePath(`/listas-precio/${id}`)
  return null
}

export async function toggleListaAction(id: string): Promise<void> {
  try {
    const { negocio, supabase } = await getCtx()
    const { data } = await supabase
      .from('listas_precio')
      .select('activo')
      .eq('id', id)
      .eq('negocio_id', negocio.id)
      .single()
    if (!data) return
    await supabase
      .from('listas_precio')
      .update({ activo: !data.activo })
      .eq('id', id)
      .eq('negocio_id', negocio.id)
  } catch {}
  revalidatePath('/listas-precio')
}

export async function eliminarListaAction(id: string): Promise<void> {
  try {
    const { negocio, supabase } = await getCtx()
    await supabase
      .from('listas_precio')
      .delete()
      .eq('id', id)
      .eq('negocio_id', negocio.id)
  } catch {}
  revalidatePath('/listas-precio')
  redirect('/listas-precio')
}

export async function upsertItemAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const lista_id = formData.get('lista_id') as string
  const producto_id = formData.get('producto_id') as string
  const precioText = formData.get('precio') as string

  const precio = textoCentavos(precioText)
  if (precio < 0) return 'El precio no puede ser negativo.'

  try {
    const { negocio, supabase } = await getCtx()
    const { error } = await supabase
      .from('lista_precio_items')
      .upsert(
        { lista_id, negocio_id: negocio.id, producto_id, precio },
        { onConflict: 'lista_id,producto_id' },
      )
    if (error) return error.message
  } catch (e: unknown) {
    return e instanceof Error ? e.message : 'Error al guardar.'
  }

  revalidatePath(`/listas-precio/${lista_id}`)
  return null
}

export async function eliminarItemAction(item_id: string, lista_id: string): Promise<void> {
  try {
    const { supabase } = await getCtx()
    await supabase.from('lista_precio_items').delete().eq('id', item_id)
  } catch {}
  revalidatePath(`/listas-precio/${lista_id}`)
}
