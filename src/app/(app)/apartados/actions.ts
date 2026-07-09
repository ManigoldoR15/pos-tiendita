'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function abonarApartadoAction(
  apartadoId: string,
  monto: number,
): Promise<{ ok: true } | { error: string }> {
  if (!Number.isFinite(monto) || monto <= 0) return { error: 'Escribe un monto válido.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('abonar_apartado', {
    p_apartado_id: apartadoId,
    p_monto: Math.round(monto),
  })
  if (error) return { error: error.message }
  revalidatePath('/apartados')
  return { ok: true }
}

export async function cancelarApartadoAction(
  apartadoId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancelar_apartado', { p_apartado_id: apartadoId })
  if (error) return { error: error.message }
  revalidatePath('/apartados')
  return { ok: true }
}
