import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Pencil, Plus, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { STOCK_MINIMO } from '@/lib/constantes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { eliminarProductoAction } from './actions'

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; alerta?: string }>
}) {
  const { categoria: categoriaFiltro, alerta } = await searchParams
  const soloStockBajo = alerta === 'bajo'
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  const supabase = await createClient()

  const [{ data: categorias }, { data: productos }] = await Promise.all([
    supabase
      .from('categorias_producto')
      .select('id, nombre')
      .eq('negocio_id', negocio!.id)
      .order('nombre'),
    supabase
      .from('productos')
      .select('id, nombre, precio_venta, existencias, activo, categoria_id, categorias_producto(nombre)')
      .eq('negocio_id', negocio!.id)
      .order('nombre'),
  ])

  const productosFiltrados = productos?.filter((p) => {
    if (categoriaFiltro && p.categoria_id !== categoriaFiltro) return false
    if (soloStockBajo && !(p.existencias > 0 && p.existencias <= STOCK_MINIMO)) return false
    return true
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Productos</h1>
        <Button asChild>
          <Link href="/productos/nuevo">
            <Plus className="h-4 w-4" />
            Nuevo
          </Link>
        </Button>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/productos"
          className={cn(
            'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
            !categoriaFiltro && !soloStockBajo ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
          )}
        >
          Todos
        </Link>
        <Link
          href="/productos?alerta=bajo"
          className={cn(
            'flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
            soloStockBajo
              ? 'border-orange-400 bg-orange-500 text-white'
              : 'border-orange-300 text-orange-600 hover:bg-orange-50',
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Stock bajo
        </Link>
        {categorias?.map((cat) => (
          <Link
            key={cat.id}
            href={`/productos?categoria=${cat.id}`}
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              categoriaFiltro === cat.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
            )}
          >
            {cat.nombre}
          </Link>
        ))}
      </div>

      {/* Grilla de productos */}
      {productosFiltrados && productosFiltrados.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {productosFiltrados.map((producto) => {
            const catNombre = (
              producto.categorias_producto as unknown as { nombre: string } | null
            )?.nombre

            return (
              <div
                key={producto.id}
                className={cn(
                  'flex flex-col rounded-xl border bg-card p-3 shadow-sm',
                  !producto.activo && 'opacity-50',
                )}
              >
                {/* Categoría badge */}
                {catNombre && (
                  <span className="mb-1 text-xs text-muted-foreground">
                    {catNombre}
                  </span>
                )}

                {/* Nombre */}
                <p className="mb-2 line-clamp-2 flex-1 text-sm font-semibold leading-tight">
                  {producto.nombre}
                </p>

                {/* Precio */}
                <p className="mb-1 text-lg font-bold text-primary">
                  {formatMXN(producto.precio_venta)}
                </p>

                {/* Existencias */}
                <p
                  className={cn(
                    'mb-3 text-xs font-medium',
                    producto.existencias === 0
                      ? 'text-destructive'
                      : producto.existencias <= 5
                        ? 'text-yellow-600'
                        : 'text-green-600',
                  )}
                >
                  {producto.existencias === 0
                    ? 'Agotado'
                    : `Stock: ${producto.existencias}`}
                </p>

                {/* Acciones */}
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/productos/${producto.id}/editar`}>
                      <Pencil className="h-3 w-3" />
                      Editar
                    </Link>
                  </Button>
                  <form action={eliminarProductoAction} data-action="eliminar-producto">
                    <input type="hidden" name="id" value={producto.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      ✕
                    </Button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-12 text-center text-muted-foreground">
          <p className="text-lg">
            {categoriaFiltro
              ? 'No hay productos en esta categoría.'
              : 'No tienes productos aún. ¡Agrega el primero!'}
          </p>
        </div>
      )}
    </div>
  )
}
