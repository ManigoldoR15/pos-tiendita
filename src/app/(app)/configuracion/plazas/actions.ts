'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

export type PlazaState = { error?: string; ok?: boolean } | null

export async function crearPlazaAction(
  _prev: PlazaState,
  formData: FormData,
): Promise<PlazaState> {
  const rol = await getRolActual()
  if (rol !== 'dueno') return { error: 'Solo el dueño puede crear plazas.' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio activo.' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const direccion = (formData.get('direccion') as string)?.trim() || null
  const color = (formData.get('color') as string)?.trim() || '#6366f1'

  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_local', {
    p_negocio_id: negocio.id,
    p_nombre: nombre,
    p_direccion: direccion,
    p_color: color,
  })

  if (error) {
    if (error.message.includes('LIMITE_PLAZAS')) {
      const msg = error.message.split('LIMITE_PLAZAS:')[1]?.trim() ?? error.message
      return { error: msg }
    }
    return { error: error.message }
  }

  revalidatePath('/configuracion/plazas')
  return { ok: true }
}

export async function editarPlazaAction(
  _prev: PlazaState,
  formData: FormData,
): Promise<PlazaState> {
  const rol = await getRolActual()
  if (rol !== 'dueno') return { error: 'Solo el dueño puede editar plazas.' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio activo.' }

  const localId = formData.get('local_id') as string
  const nombre = (formData.get('nombre') as string)?.trim()
  const direccion = (formData.get('direccion') as string)?.trim() || null
  const color = (formData.get('color') as string)?.trim() || '#6366f1'

  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (!localId) return { error: 'Plaza no identificada.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('locales')
    .update({ nombre, direccion, color })
    .eq('id', localId)
    .eq('negocio_id', negocio.id)

  if (error) return { error: error.message }

  revalidatePath('/configuracion/plazas')
  return { ok: true }
}

export async function toggleActivoPlazaAction(localId: string, activo: boolean): Promise<{ error?: string }> {
  const rol = await getRolActual()
  if (rol !== 'dueno') return { error: 'Solo el dueño puede modificar plazas.' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio activo.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('locales')
    .update({ activo })
    .eq('id', localId)
    .eq('negocio_id', negocio.id)

  if (error) return { error: error.message }

  revalidatePath('/configuracion/plazas')
  return {}
}

export async function asignarLocalEmpleadoAction(
  userId: string,
  localId: string | null,
): Promise<{ error?: string }> {
  const rol = await getRolActual()
  if (rol !== 'dueno') return { error: 'Solo el dueño puede asignar plazas.' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio activo.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('asignar_local_empleado', {
    p_negocio_id: negocio.id,
    p_user_id: userId,
    p_local_id: localId,
  })

  if (error) return { error: error.message }

  revalidatePath('/configuracion')
  return {}
}
