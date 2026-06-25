import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type Negocio = {
  id: string
  nombre: string
  suspendido: boolean
  rfc: string | null
}

export const getNegocioActual = cache(async function (): Promise<Negocio | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('usuarios_negocio')
    .select('negocios(id, nombre, suspendido, rfc)')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!data?.negocios) return null

  const negocio = data.negocios
  if (Array.isArray(negocio)) return null

  return negocio as Negocio
})
