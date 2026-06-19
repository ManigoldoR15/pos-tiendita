'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

export type CompraItem = {
  producto_id: string
  cantidad: number
  costo_unitario: number
}

export async function registrarCompraAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const negocio = await getNegocioActual()
  if (!negocio) return 'No se encontró el negocio.'

  const rol = await getRolActual()
  if (rol === 'empleado') return 'Sin permiso para registrar compras.'

  const proveedor_id = (formData.get('proveedor_id') as string) || null
  const fecha = (formData.get('fecha') as string) || new Date().toISOString().slice(0, 10)
  const notas = (formData.get('notas') as string) || ''
  const itemsJson = formData.get('items') as string

  let items: CompraItem[]
  try {
    items = JSON.parse(itemsJson)
  } catch {
    return 'Error al leer los productos de la compra.'
  }

  if (!items || items.length === 0) return 'Agrega al menos un producto.'

  for (const it of items) {
    if (!it.producto_id) return 'Producto inválido en la lista.'
    if (it.cantidad <= 0) return 'La cantidad debe ser mayor a cero.'
    if (it.costo_unitario < 0) return 'El costo unitario no puede ser negativo.'
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('registrar_compra', {
    p_negocio_id:   negocio.id,
    p_proveedor_id: proveedor_id || null,
    p_fecha:        fecha,
    p_notas:        notas,
    p_items:        items,
  })

  if (error) return error.message

  redirect(`/compras/${data}`)
}
