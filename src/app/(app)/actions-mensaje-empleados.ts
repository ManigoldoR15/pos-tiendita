'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

export async function mensajeAEmpleadosAction(
  mensaje: string,
  destinatario_id: string | null = null,   // null = broadcast a todos
) {
  if (!mensaje?.trim()) return { error: 'Mensaje vacío' }

  const rol = await getRolActual()
  if (rol === 'empleado') return { error: 'Sin permiso' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión' }

  const { error } = await supabase.from('notificaciones').insert({
    negocio_id: negocio.id,
    tipo: 'mensaje_jefe',
    titulo: destinatario_id ? 'Mensaje directo del jefe' : 'Mensaje del jefe',
    mensaje: mensaje.trim(),
    url: '/',
    leido: false,
    creado_por: user.id,
    destinatario_id: destinatario_id || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/')
  return { ok: true }
}
