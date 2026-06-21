import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'

export async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // es_superadmin() es SECURITY DEFINER — bypasea RLS para leer la tabla superadmins
  const { data } = await supabase.rpc('es_superadmin')
  if (!data) redirect('/')
  return { user, supabase }
}

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.rpc('es_superadmin')
  return !!data
}
