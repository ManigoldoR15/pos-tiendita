'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { textoCentavos } from '@/lib/dinero'

export type CorteState = { error: string } | null

export async function abrirCorteAction(
  _prev: CorteState,
  formData: FormData,
): Promise<CorteState> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const montoTexto = (formData.get('monto_inicial') as string) ?? '0'
  const monto = textoCentavos(montoTexto)
  if (monto < 0) return { error: 'El fondo inicial no puede ser negativo' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('cortes_caja').insert({
    negocio_id: negocio.id,
    abierto_por: user.id,
    monto_inicial: monto,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Ya hay un corte de caja abierto' }
    return { error: 'No se pudo abrir la caja. Intenta de nuevo.' }
  }

  revalidatePath('/corte')
  redirect('/corte')
}

export async function cerrarCorteAction(
  _prev: CorteState,
  formData: FormData,
): Promise<CorteState> {
  const corte_id = formData.get('corte_id') as string
  const montoTexto = (formData.get('monto_contado') as string) ?? '0'
  const monto = textoCentavos(montoTexto)

  if (!corte_id) return { error: 'Corte no identificado' }
  if (monto < 0) return { error: 'El monto contado no puede ser negativo' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('cerrar_corte', {
    p_corte_id: corte_id,
    p_monto_contado: monto,
  })

  if (error) return { error: error.message }

  revalidatePath('/corte')
  redirect('/corte')
}
