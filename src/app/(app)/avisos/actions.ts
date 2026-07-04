'use server'

import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

/** Marca como leídos (para este usuario) todos los mensajes del jefe visibles. */
export async function marcarAvisosLeidosAction(): Promise<void> {
  const negocio = await getNegocioActual()
  if (!negocio) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: mensajes } = await supabase
    .from('notificaciones')
    .select('id')
    .eq('negocio_id', negocio.id)
    .eq('tipo', 'mensaje_jefe')
    .limit(200)
  if (!mensajes || mensajes.length === 0) return

  // Sin revalidatePath: la etiqueta "Nuevo" se conserva durante esta visita
  // (revalidar re-renderiza la ruta actual y la borraría al instante).
  // El badge de la campanita se recalcula al navegar (el layout es dinámico).
  await supabase
    .from('notif_lecturas')
    .upsert(
      mensajes.map((m) => ({ notificacion_id: m.id, user_id: user.id })),
      { ignoreDuplicates: true },
    )
}
