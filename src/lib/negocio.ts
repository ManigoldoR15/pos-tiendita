import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type Negocio = {
  id: string
  nombre: string
  suspendido: boolean
  rfc: string | null
  modulos_habilitados: Record<string, boolean> | null
}

export const getNegocioActual = cache(async function (): Promise<Negocio | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Un usuario puede pertenecer a varios negocios. Sin un ORDER BY explícito la
  // fila elegida era arbitraria, así que a veces resolvía al negocio equivocado
  // (p. ej. leyendo módulos apagados). Elegimos de forma determinista: primero
  // donde es dueño (el enum rol_negocio ordena dueno < empleado < ...), luego la
  // membresía más antigua. Coincide con la preferencia que ya usa log_rastro.
  const { data } = await supabase
    .from('usuarios_negocio')
    .select('negocios(id, nombre, suspendido, rfc, modulos_habilitados)')
    .eq('user_id', user.id)
    .order('rol', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!data?.negocios) return null

  const negocio = data.negocios
  if (Array.isArray(negocio)) return null

  return negocio as Negocio
})
