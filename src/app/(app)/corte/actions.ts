'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { textoCentavos, formatMXN } from '@/lib/dinero'
import { notificar } from '@/lib/notificaciones'

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

  // Determinar el local del corte:
  // 1. Si el usuario tiene local asignado en usuarios_negocio → usarlo
  // 2. Si el formulario pasa local_id (dueño eligió) → usarlo
  // 3. Si solo hay un local activo → usarlo (comportamiento anterior)
  const { data: miembroLocal } = await supabase
    .from('usuarios_negocio')
    .select('local_id')
    .eq('negocio_id', negocio.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const formLocalId = (formData.get('local_id') as string | null) || null

  let localId: string | null = miembroLocal?.local_id ?? formLocalId ?? null

  if (!localId) {
    const { data: local } = await supabase
      .from('locales')
      .select('id')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('created_at')
      .limit(1)
      .maybeSingle()
    localId = local?.id ?? null
  }

  const { error } = await supabase.from('cortes_caja').insert({
    negocio_id: negocio.id,
    abierto_por: user.id,
    monto_inicial: monto,
    local_id: localId,
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
  const { data: corteResult, error } = await supabase.rpc('cerrar_corte', {
    p_corte_id: corte_id,
    p_monto_contado: monto,
  })

  if (error) return { error: error.message }

  // Fire-and-forget: notificar diferencia si la hay (no bloquea ni rompe si falla)
  const diferencia = (corteResult as { diferencia?: number } | null)?.diferencia ?? 0
  if (diferencia !== 0) {
    const negocio = await getNegocioActual()
    const { data: { user } } = await supabase.auth.getUser()
    if (negocio) {
      const signo = diferencia > 0 ? 'Sobran' : 'Faltan'
      notificar({
        negocio_id: negocio.id,
        tipo: 'diferencia_caja',
        titulo: 'Diferencia en el corte de caja',
        mensaje: `${signo} ${formatMXN(Math.abs(diferencia))} al cerrar caja. Esperado: ${formatMXN((corteResult as Record<string, number>).monto_esperado ?? 0)}, contado: ${formatMXN(monto)}.`,
        url: '/corte',
        creado_por: user?.id ?? null,
      })
    }
  }

  revalidatePath('/corte')
  redirect('/corte')
}
