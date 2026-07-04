import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// Encabezados de seguridad para todas las respuestas
const securityHeaders = [
  // Nadie puede meter la app en un iframe (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // El navegador no debe "adivinar" tipos de contenido
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // No filtrar URLs internas a sitios externos
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Solo esta página puede pedir ubicación; cámara/micrófono bloqueados
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
  // Forzar HTTPS un año (incluye subdominios)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false, // no anunciar el framework
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default withNextIntl(nextConfig)
