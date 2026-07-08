import type { Metadata } from 'next'
import Landing from './landing'

export const metadata: Metadata = {
  title: 'POS Tiendita — Punto de venta y rastreo de flotilla',
  description:
    'Sistema completo para tu negocio: ventas, inventario, fiados, corte de caja, finanzas, reportes y rastreo GPS de tus repartidores en tiempo real.',
}

export default function InicioPage() {
  return <Landing />
}
