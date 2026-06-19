'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { notificar } from '@/lib/notificaciones'

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

  // Fire-and-forget: notificar al jefe del ajuste (no bloquea ni rompe si falla)
  const { data: { user } } = await supabase.auth.getUser()
  notificar({
    negocio_id: negocio.id,
    tipo: 'ajuste_inventario',
    titulo: 'Ajuste de inventario registrado',
    mensaje: `Se registró un ajuste de ${delta > 0 ? '+' : ''}${delta} en un lote. Motivo: ${params.motivo}.${params.notas ? ` Notas: ${params.notas}` : ''}`,
    url: '/cuadre',
    creado_por: user?.id ?? null,
  })

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

  // Fire-and-forget: notificar al jefe del ajuste por pieza (no bloquea ni rompe si falla)
  const { data: { user } } = await supabase.auth.getUser()
  notificar({
    negocio_id: negocio.id,
    tipo: 'ajuste_inventario',
    titulo: 'Ajuste de inventario registrado',
    mensaje: `Se registró un ajuste de ${delta > 0 ? '+' : ''}${delta} pzas. Motivo: ${params.motivo}.${params.notas ? ` Notas: ${params.notas}` : ''}`,
    url: '/cuadre',
    creado_por: user?.id ?? null,
  })

  revalidatePath('/cuadre')
  revalidatePath('/productos')
  return { ok: true }
}
