import Link from 'next/link'
import { Package, Tag } from 'lucide-react'
import { getNegocioActual } from '@/lib/negocio'

export default async function DashboardPage() {
  const negocio = await getNegocioActual()

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Hola, {negocio!.nombre}</h1>
      <p className="mb-8 text-muted-foreground">¿Qué quieres hacer hoy?</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Link
          href="/productos"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm transition-colors hover:bg-accent"
        >
          <Package className="h-10 w-10 text-primary" />
          <span className="text-base font-semibold">Productos</span>
        </Link>

        <Link
          href="/categorias"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm transition-colors hover:bg-accent"
        >
          <Tag className="h-10 w-10 text-primary" />
          <span className="text-base font-semibold">Categorías</span>
        </Link>
      </div>
    </div>
  )
}
