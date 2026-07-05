'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

export type EntregaState = { error?: string; ok?: boolean } | null

type ItemEntrada = { producto_id: string; cantidad: number }

export async function crearEntregaAction(
  _prev: EntregaState,
  formData: FormData,
): Promise<EntregaState> {
  const rol = await getRolActual()
  if (rol !== 'dueno' && rol !== 'empleado') {
    return { error: 'Solo el dueño o un empleado pueden entregar carga.' }
  }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio activo.' }

  const repartidorId = (formData.get('repartidor_id') as string)?.trim()
  const localId = (formData.get('local_id') as string)?.trim() || null
  const nota = (formData.get('nota') as string)?.trim() || null

  if (!repartidorId) return { error: 'Elige a quién le entregas la carga.' }

  let items: ItemEntrada[] = []
  try {
    items = JSON.parse((formData.get('items') as string) ?? '[]')
  } catch {
    return { error: 'No se pudieron leer los productos.' }
  }
  items = items.filter((i) => i.producto_id && Number(i.cantidad) > 0)
  if (items.length === 0) return { error: 'Agrega al menos un producto con cantidad.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_entrega_repartidor', {
    p_negocio_id: negocio.id,
    p_repartidor_id: repartidorId,
    p_items: items.map((i) => ({ producto_id: i.producto_id, cantidad: Math.round(Number(i.cantidad)) })),
    p_local_id: localId,
    p_nota: nota,
  })

  if (error) return { error: error.message }

  revalidatePath('/reparto/entregas')
  return { ok: true }
}
