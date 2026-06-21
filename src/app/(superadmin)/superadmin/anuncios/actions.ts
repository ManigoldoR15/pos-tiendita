'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/superadmin'
import { createServiceClient } from '@/lib/supabase/service'

export async function crearAnuncioAction(fd: FormData) {
  await requireSuperAdmin()
  const admin = createServiceClient()
  const titulo = String(fd.get('titulo') ?? '').trim()
  const mensaje = String(fd.get('mensaje') ?? '').trim()
  const tipo = String(fd.get('tipo') ?? 'info')
  const expira_en = String(fd.get('expira_en') ?? '').trim() || null

  if (!titulo || !mensaje) return { error: 'Título y mensaje requeridos' }

  const { error } = await admin.from('plataforma_anuncios').insert({
    titulo, mensaje, tipo, activo: true,
    expira_en: expira_en ? new Date(expira_en).toISOString() : null,
  })
  if (error) return { error: error.message }
  revalidatePath('/superadmin/anuncios')
  return { ok: true }
}

export async function toggleAnuncioAction(id: string, activo: boolean) {
  await requireSuperAdmin()
  const admin = createServiceClient()
  const { error } = await admin.from('plataforma_anuncios').update({ activo }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/superadmin/anuncios')
  return { ok: true }
}
