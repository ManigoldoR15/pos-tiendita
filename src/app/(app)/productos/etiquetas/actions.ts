'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

/**
 * Asigna un código de barras interno a los productos que no tienen.
 * Formato: 12 dígitos empezando en "20" (rango reservado para uso interno
 * en retail, no choca con códigos comerciales EAN). Devuelve id → código.
 */
export async function asignarCodigosAction(
  productoIds: string[],
): Promise<Record<string, string> | { error: string }> {
  if (productoIds.length === 0) return {}
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio activo' }

  const supabase = await createClient()
  const asignados: Record<string, string> = {}

  for (const id of productoIds.slice(0, 100)) {
    let codigo = ''
    for (let intento = 0; intento < 5; intento++) {
      codigo = '20' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0')
      const { data: repetido } = await supabase
        .from('productos')
        .select('id')
        .eq('negocio_id', negocio.id)
        .eq('codigo_barras', codigo)
        .limit(1)
      if (!repetido || repetido.length === 0) break
    }

    const { error } = await supabase
      .from('productos')
      .update({ codigo_barras: codigo })
      .eq('id', id)
      .eq('negocio_id', negocio.id)
      .is('codigo_barras', null)
    if (error) return { error: error.message }
    asignados[id] = codigo
  }

  revalidatePath('/productos')
  return asignados
}
