import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Rutas que no requieren autenticación — usuarios autenticados también pueden acceder
const RUTAS_SIEMPRE_PUBLICAS = ['/cuenta-suspendida']

// Rutas de auth: sin sesión pueden acceder, con sesión se redirigen a /
const RUTAS_AUTH = ['/login', '/registro']

export async function proxy(request: NextRequest) {
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

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
