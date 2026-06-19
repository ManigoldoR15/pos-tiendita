'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

const MOTIVOS_VALIDOS = ['merma', 'robo', 'error_conteo', 'devolucion', 'otro'] as const
export type MotivoAjuste = typeof MOTIVOS_VALIDOS[number]

export async function registrarAjusteAction(params: {
  producto_id: string
  lote_id: string
  cantidad_fisica: number
  motivo: MotivoAjuste
  notas?: string
}): Promise<{ ok: true } | { error: string }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()

  const { data: lote } = await supabase
    .from('lotes_producto')
    .select('cantidad_actual')
    .eq('id', params.lote_id)
    .eq('negocio_id', negocio.id)
    .single()

  if (!lote) return { error: 'Lote no encontrado' }

  const delta = params.cantidad_fisica - Number(lote.cantidad_actual)

  if (delta === 0) return { error: 'La cantidad física coincide con el sistema, no se necesita ajuste' }

  const { error } = await supabase.rpc('registrar_ajuste_inventario', {
    p_negocio_id: negocio.id,
    p_producto_id: params.producto_id,
    p_lote_id: params.lote_id,
    p_delta: delta,
    p_motivo: params.motivo,
    p_notas: params.notas ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath('/cuadre')
  revalidatePath('/productos')
  return { ok: true }
}

export async function registrarAjustePiezaAction(params: {
  producto_id: string
  cantidad_fisica: number
  motivo: MotivoAjuste
  notas?: string
}): Promise<{ ok: true } | { error: string }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()

  const { data: prod } = await supabase
    .from('productos')
    .select('existencias')
    .eq('id', params.producto_id)
    .eq('negocio_id', negocio.id)
    .single()

  if (!prod) return { error: 'Producto no encontrado' }

  const delta = params.cantidad_fisica - Number(prod.existencias)

  if (delta === 0) return { error: 'El conteo físico coincide con el sistema, no se necesita ajuste' }

  const { error } = await supabase.rpc('registrar_ajuste_pieza', {
    p_negocio_id: negocio.id,
    p_producto_id: params.producto_id,
    p_delta: delta,
    p_motivo: params.motivo,
    p_notas: params.notas ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath('/cuadre')
  revalidatePath('/productos')
  return { ok: true }
}
