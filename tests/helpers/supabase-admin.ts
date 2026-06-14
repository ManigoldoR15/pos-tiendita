import { createClient } from '@supabase/supabase-js'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SVCKEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function adminClient() {
  return createClient(URL, SVCKEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function ensureUser(email: string, password: string) {
  const admin = adminClient()
  // Try to find existing user
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users.find((u) => u.email === email)
  if (existing) return existing.id

  // Create new user (email confirmed immediately)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw new Error(`Cannot create user ${email}: ${error.message}`)
  return data.user.id
}

export async function deleteUser(email: string) {
  const admin = adminClient()
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const user = list?.users.find((u) => u.email === email)
  if (user) await admin.auth.admin.deleteUser(user.id)
}
