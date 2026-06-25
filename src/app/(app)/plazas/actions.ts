'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

export async function transferirInventarioAction(
  loteId: string,
  cantidad: number,
  toLocalId: string | null,
): Promise<{ ok: true; nuevoLoteId: string } | { error: string }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('transferir_inventario_plaza', {
    p_negocio_id:  negocio.id,
    p_lote_id:     loteId,
    p_cantidad:    cantidad,
    p_to_local_id: toLocalId,
  })

  if (error) return { error: error.message }

  revalidatePath('/plazas')
  revalidatePath('/plazas/stock')
  return { ok: true, nuevoLoteId: data as string }
}

export async function asignarLotePlazaAction(
  loteId: string,
  localId: string | null,
): Promise<{ ok: true } | { error: string }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()

  // Asignar local_id directamente (sin mover cantidad — cambia etiqueta del lote)
  const { error } = await supabase
    .from('lotes_producto')
    .update({ local_id: localId })
    .eq('id', loteId)
    .eq('negocio_id', negocio.id)

  if (error) return { error: error.message }

  revalidatePath('/plazas')
  revalidatePath('/plazas/stock')
  return { ok: true }
}
