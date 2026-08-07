import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Pencil, Plus, PackagePlus, AlertTriangle, Download, Upload, Barcode } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { STOCK_MINIMO } from '@/lib/constantes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getColorCategoria } from '@/lib/colores-categoria'
import Buscador from '@/components/buscador'
import { eliminarProductoAction } from './actions'

const PAGE_SIZE = 48

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; alerta?: string; pagina?: string; q?: string }>
}) {
  const { categoria: categoriaFiltro, alerta, pagina, q } = await searchParams
  const busqueda = (q ?? '').trim()
  const paginaActual = Math.max(1, parseInt(pagina ?? '1') || 1)
  const soloStockBajo = alerta === 'bajo'
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  const supabase = await createClient()

  const desde = (paginaActual - 1) * PAGE_SIZE
  const hasta = desde + PAGE_SIZE - 1

  let query = supabase
    .from('productos')
    .select('id, nombre, precio_venta, precio_costo, existencias, activo, categoria_id, categorias_producto(nombre, color)', { count: 'exact' })
    .eq('negocio_id', negocio!.id)
    .order('nombre')

  if (categoriaFiltro) query = query.eq('categoria_id', categoriaFiltro)
  if (soloStockBajo) query = query.gt('existencias', 0).lte('existencias', STOCK_MINIMO)
  if (busqueda) query = query.ilike('nombre', `%${busqueda}%`)

  const [{ data: categorias }, { data: productos, count: totalProductos }] = await Promise.all([
    supabase
      .from('categorias_producto')
      .select('id, nombre, color')
      .eq('negocio_id', negocio!.id)
      .order('nombre'),
    query.range(desde, hasta),
  ])

  const productosFiltrados = productos ?? []
  const totalPaginas = Math.ceil((totalProductos ?? 0) / PAGE_SIZE)

  // Desglose por plaza: solo tiene sentido con dos o más plazas. En un negocio
  // de una sola plaza no se consulta nada ni cambia la vista.
  const { data: plazas } = await supabase
    .from('locales')
    .select('id, nombre, color')
    .eq('negocio_id', negocio!.id)
    .eq('activo', true)
    .order('created_at')

  const hayVariasPlazas = (plazas ?? []).length >= 2
  const stockPorPlaza = new Map<string, { nombre: string; color: string; cantidad: number }[]>()

  if (hayVariasPlazas && productosFiltrados.length > 0) {
    const { data: lotes } = await supabase
      .from('lotes_producto')
      .select('producto_id, local_id, cantidad_actual')
      .eq('negocio_id', negocio!.id)
      .eq('activo', true)
      .gt('cantidad_actual', 0)
      .in('producto_id', productosFiltrados.map((p) => p.id))

    const nombreDe = new Map((plazas ?? []).map((p) => [p.id, p]))
    for (const lote of lotes ?? []) {
      const plaza = lote.local_id ? nombreDe.get(lote.local_id) : null
      const etiqueta = plaza
        ? { nombre: plaza.nombre, color: plaza.color }
        : { nombre: 'General', color: '#94a3b8' }

      const actual = stockPorPlaza.get(lote.producto_id) ?? []
      const existente = actual.find((x) => x.nombre === etiqueta.nombre)
      if (existente) {
        existente.cantidad += Number(lote.cantidad_actual)
      } else {
        actual.push({ ...etiqueta, cantidad: Number(lote.cantidad_actual) })
      }
      stockPorPlaza.set(lote.producto_id, actual)
    }
  }

  // Build pagination URL helper
  function paginaUrl(p: number) {
    const params = new URLSearchParams()
    if (categoriaFiltro) params.set('categoria', categoriaFiltro)
    if (soloStockBajo) params.set('alerta', 'bajo')
    if (busqueda) params.set('q', busqueda)
    if (p > 1) params.set('pagina', String(p))
    const qs = params.toString()
    return `/productos${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Productos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/export/productos"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
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
          <Button variant="outline" asChild>
            <Link href="/productos/etiquetas">
              <Barcode className="h-4 w-4" />
              Etiquetas
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

      {/* Búsqueda */}
      <Buscador
        placeholder="Buscar producto por nombre…"
        defaultValue={busqueda}
        baseParams={{
          ...(categoriaFiltro ? { categoria: categoriaFiltro } : {}),
          ...(soloStockBajo ? { alerta: 'bajo' } : {}),
        }}
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/productos"
          className={cn(
            'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
            !categoriaFiltro && !soloStockBajo ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
          )}
        >
          Todos
        </Link>
        <Link
          href="/productos?alerta=bajo"
          className={cn(
            'flex items-center gap-1 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
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
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
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
            const cat = producto.categorias_producto as unknown as { nombre: string; color: string | null } | null
            const catNombre = cat?.nombre
            const colorCat = getColorCategoria(cat?.color)

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
                  'relative flex flex-col overflow-hidden card-soft p-3',
                  !producto.activo && 'opacity-50',
                )}
              >
                {colorCat && (
                  <span className={cn('absolute inset-x-0 top-0 h-1.5', colorCat.bar)} />
                )}
                {/* Categoría badge */}
                {catNombre && (
                  <span className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {colorCat && <span className={cn('h-2 w-2 rounded-full', colorCat.dot)} />}
                    {catNombre}
                  </span>
                )}

                {/* Nombre */}
                <p className="mb-2 line-clamp-2 flex-1 text-sm font-semibold leading-tight">
                  {producto.nombre}
                </p>

                {/* Precio + margen */}
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-lg font-black tracking-tight text-primary">
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

                {/* Reparto entre plazas (solo si el negocio tiene varias) */}
                {hayVariasPlazas && (stockPorPlaza.get(producto.id)?.length ?? 0) > 0 && (
                  <div className="mb-3 -mt-2 flex flex-wrap gap-1">
                    {stockPorPlaza.get(producto.id)!.map((s) => (
                      <span
                        key={s.nombre}
                        className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                        title={`${s.cantidad} en ${s.nombre}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.nombre} {s.cantidad}
                      </span>
                    ))}
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/productos/${producto.id}/editar`}>
                      <Pencil className="h-3 w-3" />
                      Editar
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild title="Agregar lote">
                    <Link href={`/productos/${producto.id}/lotes/nuevo`}>
                      <PackagePlus className="h-3 w-3" />
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
            {busqueda
              ? `No hay productos que coincidan con “${busqueda}”.`
              : categoriaFiltro
                ? 'No hay productos en esta categoría.'
                : 'No tienes productos aún. ¡Agrega el primero!'}
          </p>
        </div>
      )}
    </div>
  )
}
