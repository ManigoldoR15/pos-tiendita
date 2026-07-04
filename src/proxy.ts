import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServiceClient } from '@/lib/supabase/service'

// Rutas que no requieren autenticación — usuarios autenticados también pueden acceder
const RUTAS_SIEMPRE_PUBLICAS = ['/cuenta-suspendida']

// Rutas de auth: sin sesión pueden acceder, con sesión se redirigen a /
const RUTAS_AUTH = ['/login', '/registro']

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { supabaseResponse, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  // /registro siempre redirige a /login (registro público eliminado)
  if (pathname === '/registro') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Rutas siempre accesibles (suspendida, etc.) — nunca redirigir
  if (RUTAS_SIEMPRE_PUBLICAS.includes(pathname)) {
    return supabaseResponse
  }

  const esRutaAuth = RUTAS_AUTH.includes(pathname)

  if (!user && !esRutaAuth) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && esRutaAuth) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // ── Bitácora de accesos + registro de IP ────────────────────────────────
  // Solo para usuarios autenticados en rutas de página (no assets, no API)
  if (user && !esRutaAuth && !pathname.startsWith('/api/')) {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

    // Extraer IP real (Railway pone x-forwarded-for, primer elemento = cliente)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null

    // User-agent truncado a 200 chars — suficiente para detectar dispositivos distintos
    const ua = (request.headers.get('user-agent') ?? '').slice(0, 200) || null

    // Re-llamar si cambió el día O cambió la IP (para capturar todas las IPs del día)
    // Cookie formato: "fecha|ip" — usamos | como separador (no aparece en IPs ni fechas)
    const cookieKey = '_bla'
    const cookieVal = request.cookies.get(cookieKey)?.value ?? ''
    const pipeIdx = cookieVal.indexOf('|')
    const cookieDate = pipeIdx >= 0 ? cookieVal.slice(0, pipeIdx) : cookieVal
    const cookieIp   = pipeIdx >= 0 ? cookieVal.slice(pipeIdx + 1) : ''

    const mismoDiaYIP = cookieDate === hoy && cookieIp === (ip ?? '')

    if (!mismoDiaYIP) {
      // El builder de Supabase es lazy: solo ejecuta la petición al hacer .then().
      // waitUntil mantiene vivo el proxy hasta que termine, sin bloquear el render.
      const svc = createServiceClient()
      event.waitUntil(
        Promise.resolve(
          svc.rpc('log_acceso', {
            p_user_id:    user.id,
            p_email:      user.email ?? null,
            p_fecha:      hoy,
            p_ip:         ip,
            p_user_agent: ua,
          }),
        ).then(({ error }) => {
          if (error) console.error('log_acceso:', error.message)
        }),
      )

      supabaseResponse.cookies.set(cookieKey, `${hoy}|${ip ?? ''}`, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 86400,
      })
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
