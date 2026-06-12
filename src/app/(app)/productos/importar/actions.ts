'use server'

import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import type { FilaImport } from './importar-client'

export async function importarProductosAction(
  filas: FilaImport[],
): Promise<{ ok: number; errores: number }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { ok: 0, errores: filas.length }

  const supabase = await createClient()
  let ok = 0
  let errores = 0

  const LOTE = 100
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE)
    const rows = lote
      .filter((f) => !f.error && f.nombre && f.precio_venta > 0)
      .map((f) => ({
        negocio_id: negocio.id,
        nombre: f.nombre.trim(),
        precio_venta: f.precio_venta,
        precio_costo: f.precio_costo > 0 ? f.precio_costo : null,
        existencias: f.existencias,
        codigo_barras: f.codigo_barras || null,
        activo: true,
      }))

    if (rows.length === 0) {
      errores += lote.length
      continue
    }

    const { error, data } = await supabase
      .from('productos')
      .insert(rows)
      .select('id') as { error: unknown; data: { id: string }[] | null }

    const insertados = data?.length ?? 0
    ok += insertados
    errores += rows.length - insertados + (lote.length - rows.length)
    if (error) errores += rows.length - insertados
  }

  return { ok, errores }
}
