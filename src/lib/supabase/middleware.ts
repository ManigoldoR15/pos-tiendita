import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

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

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithDnsRetry },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() refresca el token JWT si está próximo a expirar.
  // IMPORTANTE: no usar getSession() aquí — no valida el token en servidor.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
