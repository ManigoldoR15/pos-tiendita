'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

export type CrearClienteState = { error: string } | null

export async function crearClienteAction(
  _prev: CrearClienteState,
  formData: FormData,
): Promise<CrearClienteState> {
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { error: 'Escribe el nombre del cliente' }

  const telefono = (formData.get('telefono') as string)?.trim() || null
  const notas = (formData.get('notas') as string)?.trim() || null

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { error } = await supabase.from('clientes').insert({
    negocio_id: negocio.id,
    nombre,
    telefono,
    notas,
    activo: true,
    en_lista_negra: false,
  })

  if (error) return { error: 'No se pudo guardar el cliente. Intenta de nuevo.' }

  revalidatePath('/clientes')
  redirect('/clientes')
}
