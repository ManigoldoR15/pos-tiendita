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
  if (inviteError) return { error: `Error al invitar: ${inviteError.message}` }

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
    return { error: `Error al crear negocio: ${negocioError?.message}` }
  }

  // Vincular dueño al negocio
  const { error: rolError } = await service
    .from('usuarios_negocio')
    .insert({ negocio_id: negocio.id, user_id: userId, rol: 'dueno' })

  if (rolError) return { error: `Error al asignar rol: ${rolError.message}` }

  redirect(`/admin-sistema/negocios/${negocio.id}`)
}
