'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type CrearNegocioState = { error: string } | null

export async function crearNegocioAction(
  _prevState: CrearNegocioState,
  formData: FormData,
): Promise<CrearNegocioState> {
  const nombre = (formData.get('nombre') as string)?.trim()

  if (!nombre) {
    return { error: 'Escribe el nombre de tu negocio' }
  }

  const supabase = await createClient()

  const { error } = await supabase.rpc('crear_negocio', { p_nombre: nombre })

  if (error) {
    return { error: 'No se pudo crear el negocio. Intenta de nuevo.' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
