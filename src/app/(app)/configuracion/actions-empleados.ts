'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

export type EmpleadoState = { error?: string; ok?: boolean } | null

export async function agregarEmpleadoAction(
  _prev: EmpleadoState,
  formData: FormData,
): Promise<EmpleadoState> {
  const rol = await getRolActual()
  if (rol !== 'dueno') return { error: 'Solo el dueño puede gestionar empleados.' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio activo.' }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  if (!email) return { error: 'Ingresa un correo electrónico.' }

  const supabase = await createClient()

  // Buscar usuario por email via función SECURITY DEFINER
  const { data: usuarios, error: busqErr } = await supabase
    .rpc('buscar_usuario_por_email', { p_email: email })

  if (busqErr) return { error: 'Error al buscar usuario.' }
  if (!usuarios || usuarios.length === 0)
    return { error: 'No existe una cuenta con ese correo. Pídele que se registre primero.' }

  const userId = usuarios[0].id

  // Verificar que no sea el dueño mismo
  const { data: { user } } = await supabase.auth.getUser()
  if (userId === user?.id) return { error: 'Eres el dueño, no puedes agregarte como empleado.' }

  // Verificar si ya es miembro
  const { data: existe } = await supabase
    .from('usuarios_negocio')
    .select('rol')
    .eq('negocio_id', negocio.id)
    .eq('user_id', userId)
    .single()

  if (existe) return { error: 'Este usuario ya es miembro del negocio.' }

  const { error } = await supabase
    .from('usuarios_negocio')
    .insert({ negocio_id: negocio.id, user_id: userId, rol: 'empleado' })

  if (error) return { error: 'No se pudo agregar el empleado.' }

  revalidatePath('/configuracion')
  return { ok: true }
}

export async function cambiarRolEmpleadoAction(formData: FormData): Promise<void> {
  const rol = await getRolActual()
  if (rol !== 'dueno') return

  const negocio = await getNegocioActual()
  if (!negocio) return

  const userId = formData.get('user_id') as string
  const nuevoRol = formData.get('rol') as string

  if (!['empleado', 'administrador'].includes(nuevoRol)) return

  const supabase = await createClient()
  await supabase
    .from('usuarios_negocio')
    .update({ rol: nuevoRol })
    .eq('negocio_id', negocio.id)
    .eq('user_id', userId)
    .neq('rol', 'dueno')

  revalidatePath('/configuracion')
}

export async function eliminarEmpleadoAction(formData: FormData): Promise<void> {
  const rol = await getRolActual()
  if (rol !== 'dueno') return

  const negocio = await getNegocioActual()
  if (!negocio) return

  const userId = formData.get('user_id') as string
  const supabase = await createClient()

  await supabase
    .from('usuarios_negocio')
    .delete()
    .eq('negocio_id', negocio.id)
    .eq('user_id', userId)
    .neq('rol', 'dueno')

  revalidatePath('/configuracion')
}
