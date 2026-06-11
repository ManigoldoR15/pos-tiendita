import { createClient } from '@/lib/supabase/server'

export type Negocio = {
  id: string
  nombre: string
}

export async function getNegocioActual(): Promise<Negocio | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('usuarios_negocio')
    .select('negocios(id, nombre)')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!data?.negocios) return null

  const negocio = data.negocios
  if (Array.isArray(negocio)) return null

  return negocio as Negocio
}
