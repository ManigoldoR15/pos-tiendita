import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHoraCorta } from '@/lib/fecha'
import { STOCK_MINIMO } from '@/lib/constantes'
import { PrintButton } from '@/components/print-button'

type ProductoRow = {
  id: string
  nombre: string
  precio_venta: number
  precio_costo: number | null
  existencias: number
  stock_minimo: number
  unidad_medida: string
  activo: boolean
  categorias_producto: { nombre: string } | null
}

export default async function ReporteInventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; estado?: string }>
}) {
  const { cat = 'todos', estado = 'activos' } = await searchParams

  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol === 'empleado') redirect('/')

  const supabase = await createClient()

  let query = supabase
    .from('productos')
    .select('id, nombre, precio_venta, precio_costo, existencias, stock_minimo, unidad_medida, activo, categorias_producto(nombre)')
    .eq('negocio_id', negocio.id)
    .order('nombre', { ascending: true })

  if (estado === 'activos') query = query.eq('activo', true)
  else if (estado === 'inactivos') query = query.eq('activo', false)

  const { data } = await query
  const todos = (data ?? []) as unknown as ProductoRow[]

  // Categorías únicas para filtro
  const categorias = Array.from(
    new Set(todos.map((p) => p.categorias_producto?.nombre).filter(Boolean))
  ).sort() as string[]

  const lista = cat !== 'todos'
    ? todos.filter((p) => p.categorias_producto?.nombre === cat)
    : todos

  // Métricas
  const totalProductos = lista.length
  const totalUnidades = lista.reduce((s, p) => s + p.existencias, 0)
  const valorVenta = lista.reduce((s, p) => s + p.precio_venta * p.existencias, 0)
  const valorCosto = lista.reduce((s, p) => s + (p.precio_costo ?? 0) * p.existencias, 0)
  const productosStockBajo = lista.filter((p) => p.activo && p.existencias <= STOCK_MINIMO && p.existencias > 0).length
  const sinStock = lista.filter((p) => p.activo && p.existencias <= 0).length

  const fechaGenerado = fmtFechaHoraCorta(new Date().toISOString())

  function estadoUrl(e: string) {
    const params = new URLSearchParams({ estado: e, cat })
    return `/reportes/inventario?${params.toString()}`
  }

  function catUrl(c: string) {
    const params = new URLSearchParams({ cat: c, estado })
    return `/reportes/inventario?${params.toString()}`
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Controles — ocultos al imprimir */}
      <div className="print:hidden mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/reportes"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Reportes
        </Link>

        {/* Estado */}
        <div className="flex gap-2">
          {[
            { label: 'Activos', value: 'activos' },
            { label: 'Inactivos', value: 'inactivos' },
            { label: 'Todos', value: 'todos' },
          ].map(({ label, value }) => (
            <Link
              key={value}
              href={estadoUrl(value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                estado === value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Categorías */}
        {categorias.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <Link
              href={catUrl('todos')}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                cat === 'todos' ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent'
              }`}
            >
              Todas las categorías
            </Link>
            {categorias.map((c) => (
              <Link
                key={c}
                href={catUrl(c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  cat === c ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent'
                }`}
              >
                {c}
              </Link>
            ))}
          </div>
        )}

        <PrintButton />
      </div>

      {/* ── Encabezado ── */}
      <div className="text-center mb-6 space-y-1">
        <h1 className="text-2xl font-bold">{negocio.nombre}</h1>
        <p className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
          Reporte de Inventario
          {cat !== 'todos' ? ` — ${cat}` : ''}
        </p>
        <p className="text-xs text-muted-foreground print:block hidden">Generado: {fechaGenerado}</p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">Productos</p>
          <p className="mt-1 text-lg font-bold">{totalProductos}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">Total unidades</p>
          <p className="mt-1 text-lg font-bold">{totalUnidades.toLocaleString('es-MX')}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">Valor (venta)</p>
          <p className="mt-1 text-lg font-bold text-green-600">{formatMXN(valorVenta)}</p>
        </div>
        {valorCosto > 0 ? (
          <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
            <p className="text-xs text-muted-foreground">Valor (costo)</p>
            <p className="mt-1 text-lg font-bold text-blue-600">{formatMXN(valorCosto)}</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
            <p className="text-xs text-muted-foreground">Stock bajo</p>
            <p className="mt-1 text-lg font-bold text-orange-500">{productosStockBajo}</p>
          </div>
        )}
      </div>

      {/* Alertas de stock */}
      {(productosStockBajo > 0 || sinStock > 0) && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30 p-4 mb-4 flex items-start gap-3 print:hidden">
          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-sm text-orange-700 dark:text-orange-400">
            {sinStock > 0 && <><strong>{sinStock}</strong> producto{sinStock > 1 ? 's' : ''} sin stock. </>}
            {productosStockBajo > 0 && <><strong>{productosStockBajo}</strong> con stock bajo.</>}
          </p>
        </div>
      )}

      {/* ── Tabla de productos ── */}
      {lista.length > 0 ? (
        <div className="rounded-xl border bg-card overflow-hidden mb-4">
          <h2 className="font-semibold text-sm px-4 py-3 border-b">
            Productos ({totalProductos})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Producto</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden print:table-cell sm:table-cell">Categoría</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Stock</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Precio venta</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden print:table-cell sm:table-cell">Costo</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden print:table-cell md:table-cell">Margen</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Valor total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lista.map((p) => {
                  const margen = p.precio_costo && p.precio_costo > 0
                    ? Math.round(((p.precio_venta - p.precio_costo) / p.precio_venta) * 100)
                    : null
                  const valorTotal = p.precio_venta * p.existencias
                  const stockBajo = p.activo && p.existencias <= STOCK_MINIMO && p.existencias > 0
                  const sinStockItem = p.activo && p.existencias <= 0

                  return (
                    <tr
                      key={p.id}
                      className={sinStockItem ? 'opacity-50' : ''}
                    >
                      <td className="px-4 py-2">
                        <span className="font-medium">{p.nombre}</span>
                        {!p.activo && (
                          <span className="ml-2 text-xs text-muted-foreground">(inactivo)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden print:table-cell sm:table-cell">
                        {p.categorias_producto?.nombre ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={
                            sinStockItem
                              ? 'font-semibold text-red-500'
                              : stockBajo
                              ? 'font-semibold text-orange-500'
                              : 'font-semibold'
                          }
                        >
                          {p.existencias}
                        </span>
                        {' '}
                        <span className="text-xs text-muted-foreground">
                          {p.unidad_medida !== 'pieza' ? p.unidad_medida : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{formatMXN(p.precio_venta)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground hidden print:table-cell sm:table-cell">
                        {p.precio_costo ? formatMXN(p.precio_costo) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right hidden print:table-cell md:table-cell">
                        {margen !== null ? (
                          <span className={margen >= 20 ? 'text-green-600 font-medium' : margen >= 10 ? 'text-yellow-600' : 'text-red-500'}>
                            {margen}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">{formatMXN(valorTotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td className="px-4 py-2 font-semibold" colSpan={5}>Total inventario (precio venta)</td>
                  <td className="px-4 py-2 text-right font-bold text-green-600 hidden print:table-cell md:table-cell" />
                  <td className="px-4 py-2 text-right font-bold text-green-600">{formatMXN(valorVenta)}</td>
                </tr>
                {valorCosto > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground" colSpan={5}>Total inventario (precio costo)</td>
                    <td className="px-4 py-2 text-right hidden print:table-cell md:table-cell" />
                    <td className="px-4 py-2 text-right text-blue-600">{formatMXN(valorCosto)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Sin productos en esta categoría.
        </div>
      )}
    </div>
  )
}
