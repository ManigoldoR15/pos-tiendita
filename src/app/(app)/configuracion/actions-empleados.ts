'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

export type EmpleadoState = { error?: string; ok?: boolean; mensaje?: string } | null

export async function crearNuevoEmpleadoAction(
  _prev: EmpleadoState,
  formData: FormData,
): Promise<EmpleadoState> {
  const rol = await getRolActual()
  if (rol !== 'dueno') return { error: 'Solo el dueño puede gestionar empleados.' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio activo.' }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = (formData.get('password') as string)?.trim()
  const rolNuevo = (formData.get('rol') as string) ?? 'empleado'

  if (!email) return { error: 'Ingresa un correo electrónico.' }
  if (!password || password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  if (rolNuevo !== 'empleado' && rolNuevo !== 'repartidor') return { error: 'Rol inválido.' }

  const supabase = await createClient()
  const { data: { user: dueno } } = await supabase.auth.getUser()
  if (!dueno) return { error: 'No autenticado.' }

  const admin = createServiceClient()

  // Verificar si ya existe una cuenta con ese email
  const { data: usuarios } = await supabase.rpc('buscar_usuario_por_email', { p_email: email })

  if (usuarios && usuarios.length > 0) {
    const userId = usuarios[0].id
    if (userId === dueno.id) return { error: 'Ese correo es el tuyo; no puedes agregarte como empleado.' }

    // Ya existe cuenta — solo agregarla al negocio
    const { data: existe } = await supabase
      .from('usuarios_negocio')
      .select('rol')
      .eq('negocio_id', negocio.id)
      .eq('user_id', userId)
      .single()

    if (existe) return { error: 'Ya existe un miembro con ese correo en tu negocio.' }

    const { error: insErr } = await supabase
      .from('usuarios_negocio')
      .insert({ negocio_id: negocio.id, user_id: userId, rol: rolNuevo })

    if (insErr) return { error: 'No se pudo agregar el empleado.' }
    revalidatePath('/configuracion')
    return { ok: true, mensaje: `${email} agregado como ${rolNuevo}.` }
  }

  // No existe — crear nueva cuenta
  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createErr || !newUser?.user) {
    const msg = (createErr?.message ?? '').toLowerCase()
    const esDuplicado = msg.includes('already') || msg.includes('registered') || msg.includes('duplicate')
    return { error: esDuplicado ? 'Ya existe una cuenta con ese correo electrónico.' : 'No se pudo crear la cuenta. Intenta de nuevo.' }
  }

  const { error: insErr } = await supabase
    .from('usuarios_negocio')
    .insert({ negocio_id: negocio.id, user_id: newUser.user.id, rol: rolNuevo })

  if (insErr) {
    await admin.auth.admin.deleteUser(newUser.user.id)
    return { error: 'No se pudo registrar al empleado en el negocio.' }
  }

  revalidatePath('/configuracion')
  return { ok: true, mensaje: `Cuenta creada para ${email}. Contraseña temporal: ${password}` }
}

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

  const { data: usuarios, error: busqErr } = await supabase
    .rpc('buscar_usuario_por_email', { p_email: email })

  if (busqErr) return { error: 'Error al buscar usuario.' }
  if (!usuarios || usuarios.length === 0)
    return { error: 'No existe una cuenta con ese correo.' }

  const userId = usuarios[0].id

  const { data: { user } } = await supabase.auth.getUser()
  if (userId === user?.id) return { error: 'Eres el dueño, no puedes agregarte como empleado.' }

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

  if (nuevoRol !== 'empleado' && nuevoRol !== 'repartidor') return

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
