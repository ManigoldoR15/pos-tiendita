'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type NuevoClienteState = { error: string } | null

export async function crearClienteAction(
  _prev: NuevoClienteState,
  formData: FormData,
): Promise<NuevoClienteState> {
  // Verificar superadmin
  const supabase = await createClient()
  const { data: esSA } = await supabase.rpc('es_superadmin')
  if (!esSA) return { error: 'No autorizado.' }

  const nombre    = formData.get('nombre')?.toString().trim()
  const emailDueno = formData.get('email_dueno')?.toString().trim().toLowerCase()
  const nombreDueno = formData.get('nombre_dueno')?.toString().trim()
  const telefono  = formData.get('telefono_dueno')?.toString().trim() || null
  const ubicacion = formData.get('ubicacion')?.toString().trim() || null
  const plan      = formData.get('plan')?.toString() as 'prueba' | 'mensual' | 'anual'

  if (!nombre || !emailDueno || !nombreDueno) {
    return { error: 'Nombre del negocio, email y nombre del dueño son obligatorios.' }
  }
  if (!['prueba', 'mensual', 'anual'].includes(plan)) {
    return { error: 'Plan inválido.' }
  }

  const service = createServiceClient()

  // Invitar al dueño — Supabase envía email con link de activación
  const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(
    emailDueno,
    { data: { nombre_negocio: nombre } },
  )
  if (inviteError) {
    const msg = inviteError.message.toLowerCase()
    const esDuplicado = msg.includes('already') || msg.includes('registered') || msg.includes('duplicate')
    return { error: esDuplicado ? 'Ya existe una cuenta con ese correo electrónico. El dueño debe iniciar sesión con esa cuenta.' : 'No se pudo enviar la invitación. Intenta de nuevo.' }
  }

  const userId = inviteData.user.id

  // Crear el negocio (service role bypasea RLS)
  const hoy = new Date().toISOString().split('T')[0]
  const { data: negocio, error: negocioError } = await service
    .from('negocios')
    .insert({
      nombre,
      owner_id:      userId,
      email_dueno:   emailDueno,
      nombre_dueno:  nombreDueno,
      telefono_dueno: telefono,
      ubicacion,
      plan,
      suscripcion_inicio: plan !== 'prueba' ? hoy : null,
    })
    .select('id')
    .single()

  if (negocioError || !negocio) {
    return { error: 'No se pudo crear el negocio. Intenta de nuevo.' }
  }

  // Vincular dueño al negocio
  const { error: rolError } = await service
    .from('usuarios_negocio')
    .insert({ negocio_id: negocio.id, user_id: userId, rol: 'dueno' })

  if (rolError) return { error: 'No se pudo vincular al dueño con el negocio. Intenta de nuevo.' }

  redirect(`/admin-sistema/negocios/${negocio.id}`)
}
