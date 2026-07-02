import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ShoppingCart, Receipt, Package, HandCoins, Wallet,
  ArrowRight,
} from 'lucide-react'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { hoyMX } from '@/lib/fecha'

const hoy = hoyMX()
const primerDiaMes = hoy.substring(0, 8) + '01'

type ReporteCard = {
  titulo: string
  descripcion: string
  href: string
  Icon: React.FC<{ className?: string }>
  color: string
}

const REPORTES: ReporteCard[] = [
  {
    titulo: 'Ventas',
    descripcion: 'Total recaudado, ticket promedio, top productos y detalle por venta.',
    href: `/ventas/reporte?p=mes`,
    Icon: ShoppingCart,
    color: 'text-emerald-600',
  },
  {
    titulo: 'Gastos',
    descripcion: 'Egresos del período por categoría, separados entre negocio y personales.',
    href: `/reportes/gastos?p=mes`,
    Icon: Receipt,
    color: 'text-red-500',
  },
  {
    titulo: 'Inventario',
    descripcion: 'Stock actual de todos los productos: precio, costo, margen y valor total.',
    href: `/reportes/inventario`,
    Icon: Package,
    color: 'text-blue-500',
  },
  {
    titulo: 'Corte de caja',
    descripcion: 'Historial de turnos con detalle de ventas y diferencias en efectivo.',
    href: `/corte/historial`,
    Icon: Wallet,
    color: 'text-orange-500',
  },
  {
    titulo: 'Fiados / Estado de cuenta',
    descripcion: 'Estado de cuenta por cliente: notas, abonos y saldo pendiente.',
    href: `/fiados`,
    Icon: HandCoins,
    color: 'text-purple-500',
  },
]

export default async function ReportesPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol === 'empleado') redirect('/')

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Genera e imprime reportes de tu negocio. Usa el botón{' '}
          <span className="font-medium text-foreground">Imprimir / Guardar PDF</span>{' '}
          en cada reporte para exportarlo.
        </p>
      </div>

      <div className="grid gap-3">
        {REPORTES.map(({ titulo, descripcion, href, Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="group card-soft flex items-center gap-4 p-5 transition-colors hover:bg-accent/50"
          >
            <div className={`shrink-0 rounded-xl bg-muted p-3 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{titulo}</p>
              <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{descripcion}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {negocio.nombre} · Generado {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' })}
      </p>
    </div>
  )
}
