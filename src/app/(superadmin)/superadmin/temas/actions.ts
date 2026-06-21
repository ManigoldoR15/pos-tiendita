'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/superadmin'
import { createServiceClient } from '@/lib/supabase/service'

export async function activarTemaAction(slug: string) {
  await requireSuperAdmin()
  // Usar service client — la RLS policy de temas_estacionales verifica superadmins
  // que no tiene SELECT policies, así que el user client siempre falla silenciosamente
  const svc = createServiceClient()

  // Desactivar todos
  await svc.from('temas_estacionales').update({ activo: false }).gte('id', '00000000-0000-0000-0000-000000000000')

  // Activar el elegido (si es 'default', dejar todo inactivo)
  if (slug !== 'default') {
    const { error } = await svc
      .from('temas_estacionales')
      .update({ activo: true })
      .eq('slug', slug)
    if (error) return { error: error.message }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/superadmin/temas')
  return { ok: true }
}

export async function guardarBannerAction(id: string, banner_texto: string) {
  await requireSuperAdmin()
  const svc = createServiceClient()
  const { error } = await svc
    .from('temas_estacionales')
    .update({ banner_texto: banner_texto.trim() || null })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/superadmin/temas')
  return { ok: true }
}
