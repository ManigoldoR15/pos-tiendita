'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/superadmin'
import { createServiceClient } from '@/lib/supabase/service'
import type { ModulosConfig } from '@/lib/modulos-config'

export async function toggleSuspenderAction(negocioId: string, suspender: boolean) {
  await requireSuperAdmin()
  const admin = createServiceClient()
  const { error } = await admin
    .from('negocios')
    .update({ suspendido: suspender })
    .eq('id', negocioId)
  if (error) return { error: error.message }
  revalidatePath('/superadmin/negocios')
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  return { ok: true }
}

export async function guardarNotasAdminAction(negocioId: string, notas: string) {
  await requireSuperAdmin()
  const admin = createServiceClient()
  const { error } = await admin
    .from('negocios')
    .update({ notas_admin: notas.trim() || null })
    .eq('id', negocioId)
  if (error) return { error: error.message }
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  return { ok: true }
}

export async function actualizarModulosAction(negocioId: string, modulos: ModulosConfig) {
  const { supabase } = await requireSuperAdmin()
  const { error } = await supabase.rpc('actualizar_modulos_negocio', {
    p_negocio_id: negocioId,
    p_modulos:    modulos,
  })
  if (error) return { error: error.message }
  revalidatePath('/superadmin/negocios')
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  return { ok: true }
}

export async function actualizarLicenciaPlazasAction(negocioId: string, maxPlazas: number) {
  const { supabase } = await requireSuperAdmin()
  const { error } = await supabase.rpc('actualizar_licencia_plazas', {
    p_negocio_id: negocioId,
    p_max_plazas: maxPlazas,
  })
  if (error) return { error: error.message }
  revalidatePath('/superadmin/negocios')
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  return { ok: true }
}

export async function actualizarLicenciaEmpleadosAction(negocioId: string, maxEmpleados: number) {
  const { supabase } = await requireSuperAdmin()
  const { error } = await supabase.rpc('actualizar_licencia_empleados', {
    p_negocio_id:    negocioId,
    p_max_empleados: maxEmpleados,
  })
  if (error) return { error: error.message }
  revalidatePath('/superadmin/negocios')
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  return { ok: true }
}

export async function actualizarLicenciaCajasAction(negocioId: string, maxCajas: number) {
  const { supabase } = await requireSuperAdmin()
  const { error } = await supabase.rpc('actualizar_licencia_cajas', {
    p_negocio_id: negocioId,
    p_max_cajas:  maxCajas,
  })
  if (error) return { error: error.message }
  revalidatePath('/superadmin/negocios')
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  return { ok: true }
}

export async function crearNegocioSuperadminAction(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean } | null> {
  const { supabase } = await requireSuperAdmin()
  const admin = createServiceClient()

  const nombre   = (formData.get('nombre')   as string)?.trim()
  const email    = (formData.get('email')    as string)?.trim().toLowerCase()
  const password = (formData.get('password') as string)?.trim()

  if (!nombre)  return { error: 'El nombre del negocio es obligatorio.' }
  if (!email)   return { error: 'El correo del dueño es obligatorio.' }
  if (!password || password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' }

  // Buscar si ya existe un usuario con ese email
  const { data: { users } } = await admin.auth.admin.listUsers()
  const existing = users.find((u) => u.email === email)

  let ownerId: string
  if (existing) {
    ownerId = existing.id
  } else {
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
    ownerId = newUser.user.id
  }

  const { data: negocioId, error: rpcErr } = await supabase.rpc('sa_crear_negocio', {
    p_owner_id: ownerId,
    p_nombre:   nombre,
  })
  if (rpcErr) return { error: rpcErr.message }

  revalidatePath('/superadmin/negocios')
  redirect(`/superadmin/negocios/${negocioId as string}`)
}
