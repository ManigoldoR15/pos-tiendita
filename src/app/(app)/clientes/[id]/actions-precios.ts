'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

export type PrecioEspecial = {
  id: string
  producto_id: string
  producto_nombre: string
  precio_venta: number
  precio_costo: number | null
  tipo: 'porcentaje' | 'monto_fijo'
  valor: number
}

export type PrecioEspecialPOS = Record<string, { tipo: 'porcentaje' | 'monto_fijo'; valor: number }>

export async function listarPreciosEspecialesAction(clienteId: string): Promise<PrecioEspecial[]> {
  const negocio = await getNegocioActual()
  if (!negocio) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('precios_especiales_cliente')
    .select('id, producto_id, tipo, valor, productos(nombre, precio_venta, precio_costo)')
    .eq('negocio_id', negocio.id)
    .eq('cliente_id', clienteId)
    .order('created_at')

  return (data ?? []).map((r) => {
    const prod = r.productos as unknown as { nombre: string; precio_venta: number; precio_costo: number | null } | null
    return {
      id: r.id,
      producto_id: r.producto_id,
      producto_nombre: prod?.nombre ?? 'Producto eliminado',
      precio_venta: prod?.precio_venta ?? 0,
      precio_costo: prod?.precio_costo ?? null,
      tipo: r.tipo as 'porcentaje' | 'monto_fijo',
      valor: r.valor,
    }
  })
}

export async function upsertPrecioEspecialAction(
  clienteId: string,
  productoId: string,
  tipo: 'porcentaje' | 'monto_fijo',
  valor: number,
): Promise<{ error?: string }> {
  const [negocio, rol] = await Promise.all([getNegocioActual(), getRolActual()])
  if (!negocio) return { error: 'Sin negocio activo' }
  if (rol !== 'dueno') return { error: 'Sin permiso' }

  if (tipo === 'porcentaje' && (valor < 1 || valor > 9999)) {
    return { error: 'Porcentaje inválido (1–9999 basis points)' }
  }
  if (valor <= 0) return { error: 'El valor debe ser positivo' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('precios_especiales_cliente')
    .upsert(
      { negocio_id: negocio.id, cliente_id: clienteId, producto_id: productoId, tipo, valor },
      { onConflict: 'negocio_id,cliente_id,producto_id' },
    )

  if (error) return { error: error.message }
  revalidatePath(`/clientes/${clienteId}`)
  return {}
}

export async function eliminarPrecioEspecialAction(id: string, clienteId: string): Promise<{ error?: string }> {
  const [negocio, rol] = await Promise.all([getNegocioActual(), getRolActual()])
  if (!negocio) return { error: 'Sin negocio activo' }
  if (rol !== 'dueno') return { error: 'Sin permiso' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('precios_especiales_cliente')
    .delete()
    .eq('id', id)
    .eq('negocio_id', negocio.id)

  if (error) return { error: error.message }
  revalidatePath(`/clientes/${clienteId}`)
  return {}
}

export async function getPreciosEspecialesPOSAction(clienteId: string): Promise<PrecioEspecialPOS> {
  const negocio = await getNegocioActual()
  if (!negocio) return {}

  const supabase = await createClient()
  const { data } = await supabase
    .from('precios_especiales_cliente')
    .select('producto_id, tipo, valor')
    .eq('negocio_id', negocio.id)
    .eq('cliente_id', clienteId)

  return Object.fromEntries(
    (data ?? []).map((r) => [r.producto_id, { tipo: r.tipo as 'porcentaje' | 'monto_fijo', valor: r.valor }]),
  )
}
