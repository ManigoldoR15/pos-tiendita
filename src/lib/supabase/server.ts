import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// systemd-resolved en este entorno devuelve EAI_AGAIN en los primeros 1-2 intentos.
// Este wrapper reintenta automáticamente ante errores de red (no ante respuestas HTTP de error).
async function fetchWithDnsRetry(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let last: unknown
  for (let i = 0; i < 4; i++) {
    try {
      return await fetch(url, init)
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 300 * (i + 1)))
    }
  }
  throw last
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithDnsRetry },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // En Server Components el set no tiene efecto; el proxy se encarga de refrescar la sesión.
          }
        },
      },
    },
  )
}
