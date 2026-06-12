import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Pencil, Plus, AlertTriangle, Download, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { STOCK_MINIMO } from '@/lib/constantes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { eliminarProductoAction } from './actions'

const PAGE_SIZE = 48

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; alerta?: string; pagina?: string }>
}) {
  const { categoria: categoriaFiltro, alerta, pagina } = await searchParams
  const paginaActual = Math.max(1, parseInt(pagina ?? '1') || 1)
  const soloStockBajo = alerta === 'bajo'
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  const supabase = await createClient()

  const desde = (paginaActual - 1) * PAGE_SIZE
  const hasta = desde + PAGE_SIZE - 1

  let query = supabase
    .from('productos')
    .select('id, nombre, precio_venta, precio_costo, existencias, activo, categoria_id, categorias_producto(nombre)', { count: 'exact' })
    .eq('negocio_id', negocio!.id)
    .order('nombre')

  if (categoriaFiltro) query = query.eq('categoria_id', categoriaFiltro)
  if (soloStockBajo) query = query.gt('existencias', 0).lte('existencias', STOCK_MINIMO)

  const [{ data: categorias }, { data: productos, count: totalProductos }] = await Promise.all([
    supabase
      .from('categorias_producto')
      .select('id, nombre')
      .eq('negocio_id', negocio!.id)
      .order('nombre'),
    query.range(desde, hasta),
  ])

  const productosFiltrados = productos ?? []
  const totalPaginas = Math.ceil((totalProductos ?? 0) / PAGE_SIZE)

  // Build pagination URL helper
  function paginaUrl(p: number) {
    const params = new URLSearchParams()
    if (categoriaFiltro) params.set('categoria', categoriaFiltro)
    if (soloStockBajo) params.set('alerta', 'bajo')
    if (p > 1) params.set('pagina', String(p))
    const qs = params.toString()
    return `/productos${qs ? `?${qs}` : ''}`
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Productos</h1>
        <div className="flex items-center gap-2">
          <a
            href="/api/export/productos"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Download className="h-4 w-4" />
            Excel
          </a>
          <Button variant="outline" asChild>
            <Link href="/productos/importar">
              <Upload className="h-4 w-4" />
              Importar
            </Link>
          </Button>
          <Button asChild>
            <Link href="/productos/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo
            </Link>
          </Button>
        </div>
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

      {/* Contador */}
      {(totalProductos ?? 0) > 0 && (
        <p className="mb-3 text-xs text-muted-foreground">
          {totalProductos} {totalProductos === 1 ? 'producto' : 'productos'}
          {totalPaginas > 1 && ` · Página ${paginaActual} de ${totalPaginas}`}
        </p>
      )}

      {/* Grilla de productos */}
      {productosFiltrados && productosFiltrados.length > 0 ? (
        <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {productosFiltrados.map((producto) => {
            const catNombre = (
              producto.categorias_producto as unknown as { nombre: string } | null
            )?.nombre

            const pc = (producto as unknown as { precio_costo: number | null }).precio_costo ?? 0
            const margen = pc > 0
              ? Math.round(((producto.precio_venta - pc) / producto.precio_venta) * 100)
              : null
            const margenColor = margen === null ? '' :
              margen >= 30 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
              margen >= 15 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                             'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'

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

                {/* Precio + margen */}
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-lg font-bold text-primary">
                    {formatMXN(producto.precio_venta)}
                  </p>
                  {margen !== null && (
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', margenColor)}>
                      {margen}%
                    </span>
                  )}
                </div>

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
        {/* Paginación */}

        {totalPaginas > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {paginaActual > 1 && (
              <Link
                href={paginaUrl(paginaActual - 1)}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                ← Anterior
              </Link>
            )}
            {Array.from({ length: Math.min(totalPaginas, 7) }, (_, i) => {
              const p = totalPaginas <= 7 ? i + 1
                : paginaActual <= 4 ? i + 1
                : paginaActual >= totalPaginas - 3 ? totalPaginas - 6 + i
                : paginaActual - 3 + i
              return (
                <Link
                  key={p}
                  href={paginaUrl(p)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                    p === paginaActual
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent',
                  )}
                >
                  {p}
                </Link>
              )
            })}
            {paginaActual < totalPaginas && (
              <Link
                href={paginaUrl(paginaActual + 1)}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                Siguiente →
              </Link>
            )}
          </div>
        )}
        </>
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
