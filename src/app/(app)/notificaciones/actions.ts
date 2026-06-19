'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

export type MensajeState = { error?: string; ok?: boolean } | null

export async function enviarMensajeAction(
  _prev: MensajeState,
  formData: FormData,
): Promise<MensajeState> {
  const texto = (formData.get('mensaje') as string | null)?.trim()
  if (!texto || texto.length < 3) return { error: 'El mensaje es muy corto' }
  if (texto.length > 500) return { error: 'El mensaje no puede superar 500 caracteres' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('notificaciones').insert({
    negocio_id: negocio.id,
    tipo: 'mensaje_empleado',
    titulo: 'Aviso de empleado',
    mensaje: texto,
    url: '/notificaciones',
    creado_por: user.id,
  })

  if (error) return { error: 'No se pudo enviar el aviso. Intenta de nuevo.' }
  return { ok: true }
}

export async function marcarLeidoAction(id: string): Promise<void> {
  const negocio = await getNegocioActual()
  if (!negocio) return

  const supabase = await createClient()
  await supabase
    .from('notificaciones')
    .update({ leido: true, leido_en: new Date().toISOString() })
    .eq('id', id)
    .eq('negocio_id', negocio.id)

  revalidatePath('/notificaciones')
}

export async function marcarTodasLeidasAction(): Promise<void> {
  const negocio = await getNegocioActual()
  if (!negocio) return

  const supabase = await createClient()
  await supabase
    .from('notificaciones')
    .update({ leido: true, leido_en: new Date().toISOString() })
    .eq('negocio_id', negocio.id)
    .eq('leido', false)

  revalidatePath('/notificaciones')
}
