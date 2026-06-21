'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

export async function avisarAlJefeAction(mensaje: string) {
  if (!mensaje?.trim()) return { error: 'Mensaje vacío' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión' }

  const emailNombre = user.email?.split('@')[0] ?? 'Empleado'

  const { error } = await supabase.from('notificaciones').insert({
    negocio_id: negocio.id,
    tipo: 'mensaje_empleado',
    titulo: `Aviso de ${emailNombre}`,
    mensaje: mensaje.trim(),
    url: '/notificaciones',
    leido: false,
    creado_por: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/')
  return { ok: true }
}
