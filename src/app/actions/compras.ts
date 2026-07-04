'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

const MARGEN_MINIMO_PCT = 15 // alerta cuando margen baja de este %

export type CompraItem = {
  producto_id: string
  cantidad: number
  costo_unitario: number
  caducidad?: string | null // 'YYYY-MM-DD' opcional — fecha_caducidad del lote
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
    if (it.caducidad && !/^\d{4}-\d{2}-\d{2}$/.test(it.caducidad)) {
      return 'Fecha de caducidad inválida en la lista.'
    }
  }

  const local_id = (formData.get('local_id') as string) || null

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('registrar_compra', {
    p_negocio_id:   negocio.id,
    p_proveedor_id: proveedor_id || null,
    p_fecha:        fecha,
    p_notas:        notas,
    p_items:        items,
    p_local_id:     local_id,
  })

  if (error) return error.message

  // ── Alerta de margen comprimido ──────────────────────────────────────────
  const productoIds = items.map((i) => i.producto_id)
  const { data: prods } = await supabase
    .from('productos')
    .select('id, nombre, precio_venta')
    .in('id', productoIds)
    .eq('negocio_id', negocio.id)

  const alertasMargen: string[] = []
  for (const item of items) {
    if (item.costo_unitario <= 0) continue
    const prod = prods?.find((p) => p.id === item.producto_id)
    if (!prod) continue

    if (item.costo_unitario >= prod.precio_venta) {
      alertasMargen.push(
        `${prod.nombre}: costo mayor al precio de venta — vendiendo a pérdida`,
      )
    } else {
      const margen = ((prod.precio_venta - item.costo_unitario) / prod.precio_venta) * 100
      if (margen < MARGEN_MINIMO_PCT) {
        alertasMargen.push(
          `${prod.nombre}: margen comprimido al ${Math.round(margen)}%`,
        )
      }
    }
  }

  if (alertasMargen.length > 0) {
    await supabase.from('notificaciones').insert({
      negocio_id: negocio.id,
      tipo: 'ajuste_inventario',
      titulo: `Margen bajo en ${alertasMargen.length} producto${alertasMargen.length > 1 ? 's' : ''}`,
      mensaje: alertasMargen.join('. ') + '. Considera actualizar el precio de venta.',
      url: '/productos',
      leido: false,
    })
  }

  // La compra cambia stock y listados que ya pueden estar en el router cache
  revalidatePath('/compras')
  revalidatePath('/productos')
  revalidatePath('/pos')
  revalidatePath('/caducidad')
  redirect(`/compras/${data}`)
}
