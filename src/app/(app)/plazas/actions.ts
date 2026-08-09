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

/**
 * Mueve una cantidad de un producto de una plaza a otra. El origen y el destino
 * vienen como '' cuando son el pool global (stock sin plaza asignada).
 * El reparto entre lotes lo resuelve la RPC en orden FEFO, en una transacción.
 */
export async function transferirStockAction(
  _prev: { ok?: true; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const linea = String(formData.get('linea') ?? '')
  const [productoId, varianteRaw] = linea.split('|')
  const varianteId = varianteRaw || null
  const desde = String(formData.get('desde') ?? '')
  const hacia = String(formData.get('hacia') ?? '')
  const cantidad = Number(formData.get('cantidad'))

  if (!productoId) return { error: 'Elige el producto que vas a mover' }
  // El formulario marca "sin elegir" con un centinela para no confundirlo con
  // el pool global, cuyo id es '' (ver transferir-form).
  if (desde.startsWith('__')) return { error: 'Elige de dónde vas a mover la mercancía' }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: 'La cantidad debe ser mayor que cero' }
  }
  if (desde === hacia) return { error: 'El origen y el destino son el mismo lugar' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('transferir_stock_plaza', {
    p_negocio_id:    negocio.id,
    p_producto_id:   productoId,
    p_cantidad:      cantidad,
    p_from_local_id: desde || null,
    p_to_local_id:   hacia || null,
    p_variante_id:   varianteId,
    p_notas:         null,
  })

  if (error) return { error: error.message }

  revalidatePath('/plazas')
  revalidatePath('/plazas/stock')
  revalidatePath('/productos')
  return { ok: true }
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
