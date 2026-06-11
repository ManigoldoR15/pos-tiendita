'use server'

import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

type ItemVenta = { producto_id: string; cantidad: number }

export async function registrarVentaAction(params: {
  items: ItemVenta[]
  metodo_pago_id: string
  pago_recibido: number | null
}): Promise<{ venta_id: string } | { error: string }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('registrar_venta', {
    p_negocio_id: negocio.id,
    p_items: params.items,
    p_metodo_pago_id: params.metodo_pago_id,
    p_cliente_id: null,
    p_pago_recibido: params.pago_recibido,
  })

  if (error) return { error: error.message }
  return { venta_id: data as string }
}
