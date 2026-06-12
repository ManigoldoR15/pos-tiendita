'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

export async function actualizarPresupuestoAction(formData: FormData): Promise<void> {
  const rol = await getRolActual()
  if (rol !== 'dueno') return

  const negocio = await getNegocioActual()
  if (!negocio) return

  const categoriaId = formData.get('categoria_id') as string
  const raw = (formData.get('presupuesto') as string)?.trim()
  const valor = raw ? Math.round(parseFloat(raw) * 100) : null

  if (!categoriaId) return

  const supabase = await createClient()
  await supabase
    .from('categorias_gasto')
    .update({ presupuesto: valor })
    .eq('id', categoriaId)
    .eq('negocio_id', negocio.id)

  revalidatePath('/finanzas')
}
