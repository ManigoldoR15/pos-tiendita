'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
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

// ── Dar de baja: desactiva el lote (el trigger de lotes_producto recalcula ──
// productos.existencias automáticamente). Solo dueño/admin pueden hacerlo.

export async function darDeBajaAction(formData: FormData): Promise<void> {
  const negocio = await getNegocioActual()
  if (!negocio) return

  const rol = await getRolActual()
  if (rol !== 'dueno') return

  const loteId = formData.get('lote_id') as string
  const supabase = await createClient()

  await supabase
    .from('lotes_producto')
    .update({ activo: false, estado_manual: 'negro', updated_at: new Date().toISOString() })
    .eq('id', loteId)
    .eq('negocio_id', negocio.id)

  revalidatePath('/caducidad')
  revalidatePath('/productos')
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
  if (rol !== 'dueno') return { error: 'Sin permiso' }

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
