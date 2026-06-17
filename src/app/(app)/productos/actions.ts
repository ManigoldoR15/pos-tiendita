'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { textoCentavos } from '@/lib/dinero'

export type ProductoState = { error: string } | null

type LoteCapturado = {
  cantidad: number
  cantidad_bruta: number | null
  fecha_recepcion: string
  hora_recepcion: string | null
  ubicacion: string
  fecha_caducidad: string | null
  notas: string | null
  notas_merma: string | null
}

const UNIDADES_VALIDAS = ['pieza', 'kg', 'g', 'litro', 'ml'] as const

function validarFormProducto(formData: FormData): {
  nombre: string
  precio_venta: number
  precio_costo: number | null
  categoria_id: string | null
  nueva_categoria_nombre: string | null
  codigo_barras: string | null
  activo: boolean
  unidad_medida: string
} | { error: string } {
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { error: 'Escribe el nombre del producto' }

  const precioTexto = formData.get('precio_venta') as string
  const precio_venta = textoCentavos(precioTexto)
  if (!precioTexto || precio_venta < 0) return { error: 'Escribe un precio válido' }

  const costoTexto = (formData.get('precio_costo') as string)?.trim()
  const precio_costo = costoTexto ? textoCentavos(costoTexto) : null

  const categoria_id = (formData.get('categoria_id') as string) || null
  const nueva_categoria_nombre = (formData.get('nueva_categoria_nombre') as string)?.trim() || null
  const codigo_barras = (formData.get('codigo_barras') as string)?.trim() || null
  const activo = formData.get('activo') === 'on'

  const unidad_medida = (formData.get('unidad_medida') as string) || 'pieza'
  if (!UNIDADES_VALIDAS.includes(unidad_medida as typeof UNIDADES_VALIDAS[number])) {
    return { error: 'Unidad de medida inválida' }
  }

  return { nombre, precio_venta, precio_costo, categoria_id, nueva_categoria_nombre, codigo_barras, activo, unidad_medida }
}

async function resolverCategoria(
  supabase: Awaited<ReturnType<typeof createClient>>,
  negocioId: string,
  categoriaId: string | null,
  nuevaCategoriaNombre: string | null,
): Promise<{ categoria_id: string | null } | { error: string }> {
  if (categoriaId) return { categoria_id: categoriaId }
  if (!nuevaCategoriaNombre) return { categoria_id: null }
  const { data, error } = await supabase
    .from('categorias_producto')
    .insert({ negocio_id: negocioId, nombre: nuevaCategoriaNombre })
    .select('id')
    .single()
  if (error || !data) return { error: 'No se pudo crear la categoría. Intenta de nuevo.' }
  return { categoria_id: data.id }
}

export async function crearProductoAction(
  _prev: ProductoState,
  formData: FormData,
): Promise<ProductoState> {
  const resultado = validarFormProducto(formData)
  if ('error' in resultado) return resultado

  const tipo_caducidad = formData.get('tipo_caducidad') as string
  if (tipo_caducidad !== 'envasado' && tipo_caducidad !== 'fresco') {
    return { error: 'Selecciona el tipo de manejo del producto' }
  }

  let lotes: LoteCapturado[] = []
  try {
    lotes = JSON.parse((formData.get('lotes_json') as string) || '[]')
  } catch {
    return { error: 'No se pudo leer la información del lote inicial' }
  }
  lotes = lotes.filter((l) => l.cantidad > 0)
  if (lotes.length === 0) {
    return { error: 'Agrega al menos un lote con cantidad mayor a 0' }
  }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const cat = await resolverCategoria(supabase, negocio.id, resultado.categoria_id, resultado.nueva_categoria_nombre)
  if ('error' in cat) return cat

  const { nueva_categoria_nombre: _, ...campos } = resultado
  const { data: producto, error } = await supabase
    .from('productos')
    .insert({
      ...campos,
      categoria_id: cat.categoria_id,
      negocio_id: negocio.id,
      tipo_caducidad,
      existencias: 0,
    })
    .select('id')
    .single()

  if (error || !producto) return { error: 'No se pudo guardar el producto. Intenta de nuevo.' }

  const { error: errorLotes } = await supabase.from('lotes_producto').insert(
    lotes.map((l) => ({
      negocio_id: negocio.id,
      producto_id: producto.id,
      cantidad: l.cantidad,
      cantidad_actual: l.cantidad,
      cantidad_bruta: l.cantidad_bruta ?? null,
      fecha_recepcion: l.fecha_recepcion,
      hora_recepcion: l.hora_recepcion,
      ubicacion: l.ubicacion,
      fecha_caducidad: l.fecha_caducidad,
      notas: l.notas,
      notas_merma: l.notas_merma ?? null,
    })),
  )

  if (errorLotes) {
    await supabase.from('productos').delete().eq('id', producto.id)
    return { error: 'No se pudo registrar el lote inicial. Intenta de nuevo.' }
  }

  revalidatePath('/productos')
  redirect('/productos')
}

export async function editarProductoAction(
  _prev: ProductoState,
  formData: FormData,
): Promise<ProductoState> {
  const id = formData.get('id') as string
  const resultado = validarFormProducto(formData)
  if ('error' in resultado) return resultado

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const cat = await resolverCategoria(supabase, negocio.id, resultado.categoria_id, resultado.nueva_categoria_nombre)
  if ('error' in cat) return cat

  const { nueva_categoria_nombre: _, ...campos } = resultado
  const { error } = await supabase
    .from('productos')
    .update({ ...campos, categoria_id: cat.categoria_id })
    .eq('id', id)

  if (error) return { error: 'No se pudo actualizar el producto. Intenta de nuevo.' }
  revalidatePath('/productos')
  redirect('/productos')
}

export async function eliminarProductoAction(formData: FormData): Promise<void> {
  const id = formData.get('id') as string
  const supabase = await createClient()
  await supabase.from('productos').delete().eq('id', id)
  revalidatePath('/productos')
}

export type LoteState = { error: string } | null

export async function agregarLoteAction(
  _prev: LoteState,
  formData: FormData,
): Promise<LoteState> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const producto_id = formData.get('producto_id') as string
  if (!producto_id) return { error: 'Producto inválido' }

  let lotes: LoteCapturado[] = []
  try {
    lotes = JSON.parse((formData.get('lotes_json') as string) || '[]')
  } catch {
    return { error: 'No se pudo leer la información del lote' }
  }
  lotes = lotes.filter((l) => l.cantidad > 0)
  if (lotes.length === 0) {
    return { error: 'Agrega al menos un lote con cantidad mayor a 0' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('lotes_producto').insert(
    lotes.map((l) => ({
      negocio_id: negocio.id,
      producto_id,
      cantidad: l.cantidad,
      cantidad_actual: l.cantidad,
      cantidad_bruta: l.cantidad_bruta ?? null,
      fecha_recepcion: l.fecha_recepcion,
      hora_recepcion: l.hora_recepcion,
      ubicacion: l.ubicacion,
      fecha_caducidad: l.fecha_caducidad,
      notas: l.notas,
      notas_merma: l.notas_merma ?? null,
    })),
  )

  if (error) return { error: 'No se pudo registrar el lote. Intenta de nuevo.' }

  revalidatePath('/productos')
  redirect('/productos')
}
