'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

export type EstatusClienteType = 'verde' | 'amarillo' | 'rojo'

export async function setEstatusClienteAction(
  clienteId: string,
  estatus: EstatusClienteType | null,
  nota: string | null,
): Promise<{ error?: string }> {
  const [negocio, rol] = await Promise.all([getNegocioActual(), getRolActual()])
  if (!negocio) return { error: 'Sin negocio activo' }
  if (rol !== 'dueno') return { error: 'Sin permiso' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_estatus_cliente', {
    p_cliente_id: clienteId,
    p_estatus: estatus,
    p_nota: nota || null,
  })

  if (error) return { error: error.message }
  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath('/clientes')
  return {}
}

export async function getEstatusSugeridoAction(clienteId: string): Promise<{
  sugerido: EstatusClienteType | null
  razon: string
}> {
  const negocio = await getNegocioActual()
  if (!negocio) return { sugerido: null, razon: '' }

  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('en_lista_negra')
    .eq('id', clienteId)
    .eq('negocio_id', negocio.id)
    .single()

  if (cliente?.en_lista_negra) {
    return { sugerido: 'rojo', razon: 'Está en lista negra' }
  }

  const { data: fiados } = await supabase
    .from('fiados_por_venta')
    .select('deuda, created_at')
    .eq('cliente_id', clienteId)
    .eq('negocio_id', negocio.id)
    .gt('deuda', 0)

  if (fiados && fiados.length > 0) {
    const oldest = Math.min(...fiados.map((f) => new Date(f.created_at).getTime()))
    const dias = Math.floor((Date.now() - oldest) / (1000 * 60 * 60 * 24))
    if (dias > 30) {
      return { sugerido: 'rojo', razon: `Fiado sin pagar hace ${dias} días` }
    }
    return {
      sugerido: 'amarillo',
      razon: `Tiene fiados pendientes de hace ${dias} día${dias !== 1 ? 's' : ''}`,
    }
  }

  const { count } = await supabase
    .from('ventas')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('negocio_id', negocio.id)
    .eq('estado', 'completada')

  if (count && count >= 3) {
    return { sugerido: 'verde', razon: `${count} compras sin deudas pendientes` }
  }

  return { sugerido: null, razon: 'Pocos datos para sugerir un estatus' }
}
