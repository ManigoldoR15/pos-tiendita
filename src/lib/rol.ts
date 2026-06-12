import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

export type RolNegocio = 'dueno' | 'administrador' | 'empleado'

export async function getRolActual(): Promise<RolNegocio | null> {
  const negocio = await getNegocioActual()
  if (!negocio) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('usuarios_negocio')
    .select('rol')
    .eq('negocio_id', negocio.id)
    .eq('user_id', user.id)
    .single()

  return (data?.rol as RolNegocio) ?? null
}
