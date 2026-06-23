import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { formatCantidad } from '@/lib/unidades'
import { fmtFechaCorta } from '@/lib/fecha'
import AjusteForm from './ajuste-form'
import AjusteFormPieza from './ajuste-form-pieza'

export default async function CuadrePage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol === 'empleado') redirect('/')

  const supabase = await createClient()

  // Todos los productos activos
  const { data: productos } = await supabase
    .from('productos')
    .select(`
      id, nombre, existencias, unidad_medida, tara,
      lotes_producto(id, cantidad_actual, fecha_recepcion, fecha_caducidad, notas, activo)
    `)
    .eq('negocio_id', negocio.id)
    .eq('activo', true)
    .order('nombre')

  // Ajustes recientes (últimos 50)
  const { data: ajustes } = await supabase
    .from('ajustes_inventario')
    .select('id, delta, cantidad_antes, cantidad_despues, motivo, notas, created_at, producto_id, productos(nombre)')
    .eq('negocio_id', negocio.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const productosGranel = (productos ?? [])
    .filter((p) => p.unidad_medida !== 'pieza')
    .map((p) => ({
      ...p,
      existencias: Number(p.existencias),
      tara: p.tara != null ? Number(p.tara) : null,
      lotes: (p.lotes_producto ?? [])
        .filter((l) => l.activo && Number(l.cantidad_actual) >= 0)
        .map((l) => ({ ...l, cantidad_actual: Number(l.cantidad_actual) }))
        .sort((a, b) => new Date(a.fecha_recepcion).getTime() - new Date(b.fecha_recepcion).getTime()),
    }))

  const productosPieza = (productos ?? [])
    .filter((p) => p.unidad_medida === 'pieza')
    .map((p) => ({ ...p, existencias: Number(p.existencias) }))

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Cuadre de inventario</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compara el stock físico con el sistema y registra ajustes con auditoría.
        </p>
      </div>

      {(productos ?? []).length === 0 && (
        <div className="card-soft p-8 text-center text-muted-foreground">
          <p>No hay productos registrados.</p>
        </div>
      )}

      {/* Productos por pieza */}
      {productosPieza.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-muted-foreground uppercase tracking-wide text-xs">
            Productos por pieza ({productosPieza.length})
          </h2>
          <div className="space-y-4">
            {productosPieza.map((prod) => (
              <section key={prod.id} className="card-soft overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-4">
                  <div>
                    <h3 className="font-semibold">{prod.nombre}</h3>
                    <p className="text-sm text-muted-foreground">
                      Sistema: {prod.existencias} pzas.
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                    pieza
                  </span>
                </div>
                <div className="p-5">
                  <AjusteFormPieza
                    productoId={prod.id}
                    productoNombre={prod.nombre}
                    existenciasActuales={prod.existencias}
                  />
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {/* Productos granel */}
      {productosGranel.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-muted-foreground uppercase tracking-wide text-xs">
            Productos a granel / peso ({productosGranel.length})
          </h2>
          <div className="space-y-4">
            {productosGranel.map((prod) => (
              <section key={prod.id} className="card-soft overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-4">
                  <div>
                    <h3 className="font-semibold">{prod.nombre}</h3>
                    <p className="text-sm text-muted-foreground">
                      Total en sistema: {formatCantidad(prod.existencias, prod.unidad_medida)}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                    {prod.unidad_medida}
                  </span>
                </div>
                <div className="p-5">
                  <AjusteForm
                    productoId={prod.id}
                    productoNombre={prod.nombre}
                    unidadMedida={prod.unidad_medida}
                    lotes={prod.lotes}
                    tara={prod.tara}
                  />
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {/* Historial de ajustes */}
      {(ajustes ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Historial de ajustes</h2>
          <div className="card-soft divide-y">
            {(ajustes ?? []).map((aj) => {
              const nombre = (aj.productos as unknown as { nombre: string } | null)?.nombre ?? 'Producto eliminado'
              const delta = Number(aj.delta)
              return (
                <div key={aj.id} className="flex items-start justify-between px-5 py-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="font-medium">{nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtFechaCorta(aj.created_at)} · {aj.motivo}
                      {aj.notas ? ` · ${aj.notas}` : ''}
                    </p>
                  </div>
                  <p className={`font-bold tabular-nums ${delta < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {delta > 0 ? '+' : ''}{delta.toLocaleString('es-MX', { maximumFractionDigits: 3 })}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
