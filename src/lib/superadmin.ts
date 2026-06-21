import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'

export async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) redirect('/')
  return { user, supabase }
}

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  return !!data
}
