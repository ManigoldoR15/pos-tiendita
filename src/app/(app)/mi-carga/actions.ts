'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type RespuestaState = { error?: string; ok?: boolean } | null

export async function responderEntregaAction(
  _prev: RespuestaState,
  formData: FormData,
): Promise<RespuestaState> {
  const entregaId = (formData.get('entrega_id') as string)?.trim()
  const aceptar = formData.get('aceptar') === 'true'
  const nota = (formData.get('nota') as string)?.trim() || null

  if (!entregaId) return { error: 'Entrega inválida.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('responder_entrega_repartidor', {
    p_entrega_id: entregaId,
    p_aceptar: aceptar,
    p_nota: nota,
  })

  if (error) return { error: error.message }

  revalidatePath('/mi-carga')
  return { ok: true }
}
