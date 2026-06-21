'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/superadmin'

export async function activarTemaAction(slug: string) {
  await requireSuperAdmin()
  const supabase = await createClient()

  // Desactivar todos primero
  await supabase.from('temas_estacionales').update({ activo: false }).neq('id', '00000000-0000-0000-0000-000000000000')

  // Activar el elegido (si es 'default', dejamos todo desactivado)
  if (slug !== 'default') {
    const { error } = await supabase
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
  const supabase = await createClient()
  const { error } = await supabase
    .from('temas_estacionales')
    .update({ banner_texto: banner_texto.trim() || null })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/superadmin/temas')
  return { ok: true }
}
