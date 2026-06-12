'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { hoyMX } from '@/lib/fecha'

export type MetaState = { error?: string; ok?: boolean } | null

export async function guardarMetaAction(
  _prev: MetaState,
  formData: FormData,
): Promise<MetaState> {
  const rol = await getRolActual()
  if (rol !== 'dueno') return { error: 'Solo el dueño puede definir metas.' }

  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio activo.' }

  const rawMonto = (formData.get('meta_ventas') as string)?.trim()
  const montoFloat = parseFloat(rawMonto)
  if (!rawMonto || isNaN(montoFloat) || montoFloat <= 0)
    return { error: 'Ingresa un monto válido mayor a cero.' }

  // Convert MXN pesos to centavos
  const metaCentavos = Math.round(montoFloat * 100)

  // Use start of current month as the "mes" value
  const hoy = hoyMX()
  const mes = hoy.substring(0, 8) + '01'

  const supabase = await createClient()
  const { error } = await supabase.from('metas').upsert(
    { negocio_id: negocio.id, mes, meta_ventas: metaCentavos },
    { onConflict: 'negocio_id,mes' },
  )

  if (error) return { error: 'No se pudo guardar la meta.' }
  revalidatePath('/')
  revalidatePath('/configuracion')
  return { ok: true }
}
