'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { textoCentavos } from '@/lib/dinero'

export type ProductoState = { error: string } | null

function validarFormProducto(formData: FormData): {
  nombre: string
  precio_venta: number
  precio_costo: number | null
  categoria_id: string | null
  nueva_categoria_nombre: string | null
  existencias: number
  codigo_barras: string | null
  activo: boolean
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
  const existencias = parseInt(formData.get('existencias') as string) || 0
  const codigo_barras = (formData.get('codigo_barras') as string)?.trim() || null
  const activo = formData.get('activo') === 'on'

  return { nombre, precio_venta, precio_costo, categoria_id, nueva_categoria_nombre, existencias, codigo_barras, activo }
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

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const cat = await resolverCategoria(supabase, negocio.id, resultado.categoria_id, resultado.nueva_categoria_nombre)
  if ('error' in cat) return cat

  const { nueva_categoria_nombre: _, ...campos } = resultado
  const { error } = await supabase.from('productos').insert({
    ...campos,
    categoria_id: cat.categoria_id,
    negocio_id: negocio.id,
  })

  if (error) return { error: 'No se pudo guardar el producto. Intenta de nuevo.' }
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
