'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type SuscripcionState = { ok: true } | { error: string } | null

export async function actualizarSuscripcionAction(
  _prev: SuscripcionState,
  formData: FormData,
): Promise<SuscripcionState> {
  const supabase = await createClient()
  const { data: esSA } = await supabase.rpc('es_superadmin')
  if (!esSA) return { error: 'No autorizado.' }

  const negocioId    = formData.get('negocio_id')?.toString()
  const plan         = formData.get('plan')?.toString()
  const inicio       = formData.get('suscripcion_inicio')?.toString() || null
  const fin          = formData.get('suscripcion_fin')?.toString() || null
  const suspendido   = formData.get('suspendido') === 'true'
  const notasAdmin   = formData.get('notas_admin')?.toString().trim() || null
  const nombreNegocio = formData.get('nombre_negocio')?.toString().trim()
  const emailDueno   = formData.get('email_dueno')?.toString().trim().toLowerCase() || null
  const nombreDueno  = formData.get('nombre_dueno')?.toString().trim() || null
  const telefonoDueno = formData.get('telefono_dueno')?.toString().trim() || null
  const ubicacion    = formData.get('ubicacion')?.toString().trim() || null

  if (!negocioId || !plan || !nombreNegocio) return { error: 'Datos incompletos.' }
  if (!['prueba', 'mensual', 'anual'].includes(plan)) return { error: 'Plan inválido.' }

  // Actualizar info del negocio (RLS "superadmin_editar_negocios" lo permite)
  const { error: updateError } = await supabase
    .from('negocios')
    .update({
      nombre:         nombreNegocio,
      email_dueno:    emailDueno,
      nombre_dueno:   nombreDueno,
      telefono_dueno: telefonoDueno,
      ubicacion,
    })
    .eq('id', negocioId)

  if (updateError) return { error: `Error al actualizar negocio: ${updateError.message}` }

  // Actualizar suscripción via SECURITY DEFINER (validación extra en DB)
  const { error: rpcError } = await supabase.rpc('actualizar_suscripcion', {
    p_negocio_id:         negocioId,
    p_plan:               plan,
    p_suscripcion_inicio: inicio,
    p_suscripcion_fin:    fin,
    p_suspendido:         suspendido,
    p_notas_admin:        notasAdmin,
  })

  if (rpcError) return { error: `Error al actualizar suscripción: ${rpcError.message}` }

  revalidatePath(`/admin-sistema/negocios/${negocioId}`)
  revalidatePath('/admin-sistema')
  revalidatePath('/admin-sistema/negocios')

  return { ok: true }
}
