'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { hoyMX } from '@/lib/fecha'
import { DEFAULTS_PERECEDERO } from '@/lib/caducidad'

// Siembra categorías por defecto (FDA/FAO/AESAN) si el negocio no tiene ninguna
export async function seedCategoriasIfEmpty(negocioId: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('categorias_perecedero')
    .select('*', { count: 'exact', head: true })
    .eq('negocio_id', negocioId)

  if ((count ?? 0) === 0) {
    await supabase
      .from('categorias_perecedero')
      .insert(DEFAULTS_PERECEDERO.map((d) => ({ ...d, negocio_id: negocioId })))
  }
}

// ── Registrar lote nuevo ──────────────────────────────────────────────────────

export type LoteState = { error: string } | null

export async function registrarLoteAction(
  _prev: LoteState,
  formData: FormData,
): Promise<LoteState> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const producto_id    = formData.get('producto_id') as string
  const cantidadStr    = formData.get('cantidad') as string
  const fecha_recepcion = (formData.get('fecha_recepcion') as string) || hoyMX()
  const ubicacion      = (formData.get('ubicacion') as string) || 'ambiente'
  const fecha_caducidad = formData.get('fecha_caducidad') as string
  const notas          = (formData.get('notas') as string)?.trim() || null

  if (!producto_id)     return { error: 'Selecciona un producto' }
  if (!fecha_caducidad) return { error: 'La fecha de caducidad es obligatoria' }

  const cantidad = parseInt(cantidadStr)
  if (!cantidad || cantidad < 1) return { error: 'La cantidad debe ser mayor a 0' }

  if (fecha_caducidad < fecha_recepcion) {
    return { error: 'La fecha de caducidad no puede ser anterior a la recepción' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('lotes_producto').insert({
    negocio_id: negocio.id,
    producto_id,
    cantidad,
    fecha_recepcion,
    ubicacion,
    fecha_caducidad,
    notas,
  })

  if (error) return { error: `Error al registrar: ${error.message}` }

  revalidatePath('/caducidad')
  redirect('/caducidad')
}

// ── Marcar lote como no apto (negro) ─────────────────────────────────────────

export async function marcarNegroAction(formData: FormData): Promise<void> {
  const negocio = await getNegocioActual()
  if (!negocio) return

  const loteId = formData.get('lote_id') as string
  const supabase = await createClient()
  await supabase
    .from('lotes_producto')
    .update({ estado_manual: 'negro', updated_at: new Date().toISOString() })
    .eq('id', loteId)
    .eq('negocio_id', negocio.id)

  revalidatePath('/caducidad')
}

// ── Dar de baja: desactiva lote y descuenta del inventario ───────────────────
// Solo dueño/admin pueden descontar del inventario

export async function darDeBajaAction(formData: FormData): Promise<void> {
  const negocio = await getNegocioActual()
  if (!negocio) return

  const loteId = formData.get('lote_id') as string
  const supabase = await createClient()

  const { data: lote } = await supabase
    .from('lotes_producto')
    .select('producto_id, cantidad')
    .eq('id', loteId)
    .eq('negocio_id', negocio.id)
    .single()

  if (!lote) return

  // Desactivar lote y marcar negro
  await supabase
    .from('lotes_producto')
    .update({ activo: false, estado_manual: 'negro', updated_at: new Date().toISOString() })
    .eq('id', loteId)

  // Descontar inventario (solo si el rol lo permite — la RLS en productos lo aplica)
  const rol = await getRolActual()
  if (rol === 'dueno' || rol === 'administrador') {
    const { data: prod } = await supabase
      .from('productos')
      .select('existencias')
      .eq('id', lote.producto_id)
      .single()

    if (prod) {
      await supabase
        .from('productos')
        .update({ existencias: Math.max(0, prod.existencias - lote.cantidad) })
        .eq('id', lote.producto_id)
    }
  }

  revalidatePath('/caducidad')
}

// ── Categorías perecedero ────────────────────────────────────────────────────

export type CatState = { error: string } | null

export async function crearCategoriaAction(
  _prev: CatState,
  formData: FormData,
): Promise<CatState> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio' }

  const rol = await getRolActual()
  if (rol !== 'dueno' && rol !== 'administrador') return { error: 'Sin permiso' }

  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { error: 'El nombre es obligatorio' }

  const dias_refri      = parseInt(formData.get('dias_refri') as string) || null
  const dias_congelador = parseInt(formData.get('dias_congelador') as string) || null
  const dias_ambiente   = parseInt(formData.get('dias_ambiente') as string) || null

  if (!dias_refri && !dias_congelador && !dias_ambiente) {
    return { error: 'Ingresa al menos un valor de días de vida útil' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('categorias_perecedero').insert({
    negocio_id: negocio.id,
    nombre,
    dias_refri,
    dias_congelador,
    dias_ambiente,
  })

  if (error) return { error: error.message }
  revalidatePath('/caducidad/configuracion')
  return null
}

export async function eliminarCategoriaAction(formData: FormData): Promise<void> {
  const negocio = await getNegocioActual()
  if (!negocio) return
  const id = formData.get('id') as string
  const supabase = await createClient()
  await supabase
    .from('categorias_perecedero')
    .delete()
    .eq('id', id)
    .eq('negocio_id', negocio.id)
  revalidatePath('/caducidad/configuracion')
}
