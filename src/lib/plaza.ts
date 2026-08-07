import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

export type PlazaUsuario = { id: string; nombre: string }

/**
 * Plaza asignada al usuario actual, o null si vende sin plaza (negocios de una
 * sola plaza y dueños que venden desde donde sea). Es el mismo local_id que
 * registrar_venta usa para decidir de qué lotes descontar: cuando es null el
 * FEFO es global, igual que siempre.
 */
export const getPlazaActual = cache(async function (): Promise<PlazaUsuario | null> {
  const negocio = await getNegocioActual()
  if (!negocio) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('usuarios_negocio')
    .select('local_id, locales(id, nombre)')
    .eq('negocio_id', negocio.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data?.local_id) return null

  const local = data.locales as unknown as { id: string; nombre: string } | null
  return { id: data.local_id, nombre: local?.nombre ?? 'Mi plaza' }
})

/** Solo el id — para quien no necesita el nombre. */
export async function getLocalIdUsuario(): Promise<string | null> {
  return (await getPlazaActual())?.id ?? null
}
