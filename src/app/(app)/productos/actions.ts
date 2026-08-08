'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
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
  tara: number | null
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

  // Tara: solo aplica a granel, debe ser >= 0
  let tara: number | null = null
  if (unidad_medida !== 'pieza') {
    const taraTexto = (formData.get('tara') as string)?.trim()
    if (taraTexto) {
      const taraNum = parseFloat(taraTexto)
      if (isNaN(taraNum) || taraNum < 0) return { error: 'Tara inválida: debe ser 0 o mayor' }
      tara = taraNum
    }
  }

  return { nombre, precio_venta, precio_costo, categoria_id, nueva_categoria_nombre, codigo_barras, activo, unidad_medida, tara }
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

/**
 * Plaza elegida en el formulario, verificada contra el negocio. null = general
 * (sin plaza), que es el destino por omisión y el único que existía antes del
 * multi-plaza. Se valida aquí porque lotes_producto no comprueba que el local
 * pertenezca al negocio: sin esto, un local_id ajeno se guardaría tal cual.
 */
async function resolverLocalId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  negocioId: string,
  formData: FormData,
): Promise<{ local_id: string | null } | { error: string }> {
  const localId = (formData.get('local_id') as string)?.trim() || null
  if (!localId) return { local_id: null }

  const { data } = await supabase
    .from('locales')
    .select('id')
    .eq('id', localId)
    .eq('negocio_id', negocioId)
    .eq('activo', true)
    .maybeSingle()

  if (!data) return { error: 'La plaza seleccionada no existe o está inactiva.' }
  return { local_id: localId }
}

type VarianteCapturada = { valor1: string; valor2: string | null; cantidad: number }

export async function crearProductoAction(
  _prev: ProductoState,
  formData: FormData,
): Promise<ProductoState> {
  const resultado = validarFormProducto(formData)
  if ('error' in resultado) return resultado

  // ── Variantes (talla/color) — sustituyen al lote inicial manual ────────────
  const conVariantes = formData.get('con_variantes') === 'on'
  let variantes: VarianteCapturada[] = []
  let atributo1: string | null = null
  let atributo2: string | null = null
  if (conVariantes) {
    atributo1 = (formData.get('atributo1') as string)?.trim() || null
    atributo2 = (formData.get('atributo2') as string)?.trim() || null
    if (!atributo1) return { error: 'Escribe el nombre del atributo (p. ej. Talla)' }
    try {
      variantes = JSON.parse((formData.get('variantes_json') as string) || '[]')
    } catch {
      return { error: 'No se pudo leer las variantes' }
    }
    variantes = variantes.filter((v) => v.valor1?.trim())
    if (variantes.length === 0) {
      return { error: 'Agrega al menos una variante' }
    }
    const combos = new Set(variantes.map((v) => `${v.valor1.trim().toLowerCase()}|${(v.valor2 ?? '').trim().toLowerCase()}`))
    if (combos.size !== variantes.length) {
      return { error: 'Hay variantes repetidas' }
    }
    if (variantes.some((v) => v.cantidad < 0 || !Number.isFinite(v.cantidad))) {
      return { error: 'Cantidad inválida en una variante' }
    }
  }

  let tipo_caducidad = formData.get('tipo_caducidad') as string
  if (conVariantes) {
    tipo_caducidad = 'envasado' // ropa y similares: sin manejo de caducidad
  } else if (tipo_caducidad !== 'envasado' && tipo_caducidad !== 'fresco') {
    return { error: 'Selecciona el tipo de manejo del producto' }
  }

  let lotes: LoteCapturado[] = []
  if (!conVariantes) {
    try {
      lotes = JSON.parse((formData.get('lotes_json') as string) || '[]')
    } catch {
      return { error: 'No se pudo leer la información del lote inicial' }
    }
    lotes = lotes.filter((l) => l.cantidad > 0)
    if (lotes.length === 0) {
      return { error: 'Agrega al menos un lote con cantidad mayor a 0' }
    }
  }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const cat = await resolverCategoria(supabase, negocio.id, resultado.categoria_id, resultado.nueva_categoria_nombre)
  if ('error' in cat) return cat

  // Plaza donde nace el stock inicial. Sin plazas el select no se pinta y esto
  // queda en null, que es exactamente el comportamiento de siempre.
  const local = await resolverLocalId(supabase, negocio.id, formData)
  if ('error' in local) return local

  const { nueva_categoria_nombre: _, ...campos } = resultado
  const { data: producto, error } = await supabase
    .from('productos')
    .insert({
      ...campos,
      categoria_id: cat.categoria_id,
      negocio_id: negocio.id,
      tipo_caducidad,
      existencias: 0,
      tiene_variantes: conVariantes,
      atributo1: conVariantes ? atributo1 : null,
      atributo2: conVariantes ? atributo2 : null,
    })
    .select('id')
    .single()

  if (error || !producto) return { error: 'No se pudo guardar el producto. Intenta de nuevo.' }

  if (conVariantes) {
    // Crear variantes; su existencia inicial entra como un lote por variante
    const { data: varsCreadas, error: errorVars } = await supabase
      .from('variantes_producto')
      .insert(
        variantes.map((v) => ({
          negocio_id: negocio.id,
          producto_id: producto.id,
          valor1: v.valor1.trim(),
          valor2: v.valor2?.trim() || null,
        })),
      )
      .select('id, valor1, valor2')

    if (errorVars || !varsCreadas) {
      await supabase.from('productos').delete().eq('id', producto.id)
      return { error: 'No se pudieron crear las variantes. Intenta de nuevo.' }
    }

    const hoyMx = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
    const lotesVariantes = varsCreadas
      .map((vc) => {
        const cap = variantes.find(
          (v) => v.valor1.trim() === vc.valor1 && (v.valor2?.trim() || null) === vc.valor2,
        )
        return { variante_id: vc.id, cantidad: cap?.cantidad ?? 0 }
      })
      .filter((l) => l.cantidad > 0)

    if (lotesVariantes.length > 0) {
      const { error: errorLotesVar } = await supabase.from('lotes_producto').insert(
        lotesVariantes.map((l) => ({
          negocio_id: negocio.id,
          producto_id: producto.id,
          variante_id: l.variante_id,
          cantidad: l.cantidad,
          cantidad_actual: l.cantidad,
          fecha_recepcion: hoyMx,
          ubicacion: 'ambiente',
          fecha_caducidad: null,
          local_id: local.local_id,
          notas: 'Existencia inicial de la variante',
        })),
      )
      if (errorLotesVar) {
        await supabase.from('productos').delete().eq('id', producto.id)
        return { error: 'No se pudo registrar la existencia inicial de las variantes.' }
      }
    }
  } else {
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
        local_id: local.local_id,
      })),
    )

    if (errorLotes) {
      await supabase.from('productos').delete().eq('id', producto.id)
      return { error: 'No se pudo registrar el lote inicial. Intenta de nuevo.' }
    }
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
  const [negocio, rol] = await Promise.all([getNegocioActual(), getRolActual()])
  if (!negocio) return { error: 'No hay negocio activo' }
  if (rol !== 'dueno') return { error: 'Sin permiso' }

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

  const local = await resolverLocalId(supabase, negocio.id, formData)
  if ('error' in local) return local

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
      local_id: local.local_id,
    })),
  )

  if (error) return { error: 'No se pudo registrar el lote. Intenta de nuevo.' }

  revalidatePath('/productos')
  redirect('/productos')
}
