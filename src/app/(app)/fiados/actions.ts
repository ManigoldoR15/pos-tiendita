'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

export async function registrarAbonoAction(params: {
  cliente_id: string
  monto: number
  venta_id?: string | null
  notas?: string
}): Promise<{ error: string } | { ok: true }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('registrar_abono', {
    p_negocio_id: negocio.id,
    p_cliente_id: params.cliente_id,
    p_monto: params.monto,
    p_venta_id: params.venta_id ?? null,
    p_notas: params.notas ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath('/fiados')
  revalidatePath(`/fiados/${params.cliente_id}`)
  revalidatePath('/')
  return { ok: true }
}

export async function cambiarListaNegraAction(params: {
  cliente_id: string
  en_lista_negra: boolean
  motivo?: string
}): Promise<{ error: string } | { ok: true }> {
  const rol = await getRolActual()
  if (rol !== 'dueno') return { error: 'Solo el dueño puede gestionar la lista negra.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('cambiar_lista_negra', {
    p_cliente_id: params.cliente_id,
    p_en_lista_negra: params.en_lista_negra,
    p_motivo: params.motivo ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath('/fiados')
  revalidatePath(`/fiados/${params.cliente_id}`)
  return { ok: true }
}
