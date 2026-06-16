'use server'

import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

type ItemVenta = { producto_id: string; cantidad: number; es_fiado?: boolean }

export type ClienteSugerido = {
  id: string
  nombre: string
  telefono: string | null
  en_lista_negra: boolean
  motivo_lista_negra: string | null
}

export async function registrarVentaAction(params: {
  items: ItemVenta[]
  metodo_pago_id: string
  pago_recibido: number | null
  descuento?: number
  cliente_id?: string | null
}): Promise<{ venta_id: string } | { error: string }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase.rpc('registrar_venta', {
    p_negocio_id: negocio.id,
    p_items: params.items,
    p_metodo_pago_id: params.metodo_pago_id,
    p_cliente_id: params.cliente_id ?? null,
    p_pago_recibido: params.pago_recibido,
    p_descuento: params.descuento ?? 0,
    p_vendedor_id: user?.id ?? null,
  })

  if (error) return { error: error.message }
  return { venta_id: data as string }
}

export async function buscarClientesAction(q: string): Promise<ClienteSugerido[]> {
  const term = q.trim()
  if (term.length < 2) return []
  const negocio = await getNegocioActual()
  if (!negocio) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, en_lista_negra, motivo_lista_negra')
    .eq('negocio_id', negocio.id)
    .eq('activo', true)
    .or(`nombre.ilike.%${term}%,telefono.ilike.%${term}%`)
    .order('nombre')
    .limit(6)

  return data ?? []
}

export async function crearClienteAction(
  nombre: string,
  telefono?: string,
): Promise<ClienteSugerido | { error: string }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .insert({
      negocio_id: negocio.id,
      nombre: nombre.trim(),
      telefono: telefono?.trim() || null,
    })
    .select('id, nombre, telefono, en_lista_negra, motivo_lista_negra')
    .single()

  if (error) return { error: error.message }
  return data
}
