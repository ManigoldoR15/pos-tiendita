/**
 * Supabase clients for test environment (Node.js 20 needs ws transport).
 */
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const OPTS = { global: { fetch: globalThis.fetch as typeof fetch, headers: {} }, realtime: { transport: ws as unknown as typeof WebSocket } }

export function adminSupabase() {
  return createClient(URL, SVC_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...OPTS,
  })
}

export async function userSupabase(email: string, password: string) {
  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...OPTS,
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`)
  return client
}
