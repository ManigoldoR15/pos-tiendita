import type { Metadata } from 'next'
import Landing from './landing'

const TITULO = 'POS Tiendita — Punto de venta y rastreo de flotilla'
const DESCRIPCION =
  'Sistema completo para tu negocio: ventas, inventario, fiados, corte de caja, finanzas, reportes y rastreo GPS de tus repartidores en tiempo real.'

export const metadata: Metadata = {
  // Base para resolver las imágenes OG como URL absoluta (WhatsApp lo exige).
  // Cambiar cuando haya dominio propio.
  metadataBase: new URL('https://earnest-fascination-production-6a24.up.railway.app'),
  title: TITULO,
  description: DESCRIPCION,
  // Tarjeta de vista previa al compartir el link (WhatsApp, Facebook, etc.)
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    type: 'website',
    locale: 'es_MX',
    images: [{ url: '/og-inicio.png', width: 1200, height: 630, alt: 'POS Tiendita — Todo tu negocio, bajo control' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRIPCION,
    images: ['/og-inicio.png'],
  },
}

export default function InicioPage() {
  return <Landing />
}
