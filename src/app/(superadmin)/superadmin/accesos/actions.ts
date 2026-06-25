'use server'

import { requireSuperAdmin } from '@/lib/superadmin'
import { revalidatePath } from 'next/cache'

export async function toggleSospecha(negocioId: string, sospecha: boolean) {
  const { supabase } = await requireSuperAdmin()
  await supabase.rpc('sa_marcar_sospecha', {
    p_negocio_id: negocioId,
    p_sospecha:   sospecha,
  })
  revalidatePath('/superadmin/accesos')
}
