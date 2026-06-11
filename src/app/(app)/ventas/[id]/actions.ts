'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

export async function anularVentaAction(ventaId: string): Promise<{ error: string } | void> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('anular_venta', { p_venta_id: ventaId })

  if (error) return { error: error.message }

  revalidatePath(`/ventas/${ventaId}`)
  revalidatePath('/ventas')
  revalidatePath('/')
  redirect(`/ventas/${ventaId}`)
}
