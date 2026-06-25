'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/superadmin'
import { createServiceClient } from '@/lib/supabase/service'

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
