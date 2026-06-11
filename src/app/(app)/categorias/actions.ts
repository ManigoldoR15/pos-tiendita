'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

export type CategoriaState = { error: string } | null

export async function crearCategoriaAction(
  _prev: CategoriaState,
  formData: FormData,
): Promise<CategoriaState> {
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { error: 'Escribe el nombre de la categoría' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('categorias_producto')
    .insert({ nombre, negocio_id: negocio.id })

  if (error) return { error: 'No se pudo guardar. Intenta de nuevo.' }
  revalidatePath('/categorias')
  return null
}

export async function editarCategoriaAction(
  _prev: CategoriaState,
  formData: FormData,
): Promise<CategoriaState> {
  const id = formData.get('id') as string
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { error: 'Escribe el nombre de la categoría' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('categorias_producto')
    .update({ nombre })
    .eq('id', id)

  if (error) return { error: 'No se pudo actualizar. Intenta de nuevo.' }
  revalidatePath('/categorias')
  revalidatePath('/productos')
  redirect('/categorias')
}

export async function eliminarCategoriaAction(formData: FormData): Promise<void> {
  const id = formData.get('id') as string
  const supabase = await createClient()
  await supabase.from('categorias_producto').delete().eq('id', id)
  revalidatePath('/categorias')
  revalidatePath('/productos')
}
