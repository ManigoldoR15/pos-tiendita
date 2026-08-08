import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingDown, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { hoyMX, addDaysMX, mexicoDayRange } from '@/lib/fecha'
import { STOCK_MINIMO } from '@/lib/constantes'
import { formatMXN } from '@/lib/dinero'
import CompraForm from './compra-form'

const DIAS_COBERTURA = 7

export default async function NuevaCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ plaza?: string }>
}) {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const { plaza: plazaPedida } = await searchParams

  const supabase = await createClient()
  const hoy = hoyMX()
  const hace30 = addDaysMX(hoy, -30)
  const { start: start30 } = mexicoDayRange(hace30)

  const [
    { data: productos },
    { data: proveedores },
    { data: productosAlerta },
    { data: plazas },
  ] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, precio_costo, unidad_medida, tara')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('productos')
      .select('id, nombre, existencias, unidad_medida')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .lte('existencias', STOCK_MINIMO)
      .order('existencias', { ascending: true })
      .limit(10),
    supabase
      .from('locales')
      .select('id, nombre')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
  ])

  // Plaza preseleccionada al llegar desde /plazas/[id]. Si el id no es de este
  // negocio simplemente no se preselecciona nada.
  const plazaInicial = (plazas ?? []).some((p) => p.id === plazaPedida) ? plazaPedida! : ''

  // Velocidad de venta últimos 30 días para productos en alerta
  const alertaIds = (productosAlerta ?? []).map((p) => p.id)
  const velocidadMap = new Map<string, number>()

  if (alertaIds.length > 0) {
    const { data: ventaItems } = await supabase
      .from('venta_items')
      .select('producto_id, cantidad, ventas!inner(created_at, estado)')
      .in('producto_id', alertaIds)
      .eq('ventas.estado', 'completada')
      .gte('ventas.created_at', start30)

    for (const vi of ventaItems ?? []) {
      velocidadMap.set(vi.producto_id, (velocidadMap.get(vi.producto_id) ?? 0) + vi.cantidad)
    }
    for (const [pid, total] of velocidadMap) {
      velocidadMap.set(pid, total / 30) // unidades por día
    }
  }

  const sugerencias = (productosAlerta ?? []).map((p) => {
    const vel = velocidadMap.get(p.id) ?? 0
    const diasStock = vel > 0 ? Math.round(p.existencias / vel) : null
    const cantSugerida = vel > 0 ? Math.max(1, Math.ceil(vel * DIAS_COBERTURA)) : null
    return { ...p, vel, diasStock, cantSugerida }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/compras"
          className="flex h-9 w-9 items-center justify-center rounded-xl border bg-card text-muted-foreground transition hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Registrar entrada</h1>
          <p className="text-sm text-muted-foreground">Nueva llegada de mercancía</p>
        </div>
      </div>

      {/* Lista de reabasto automática */}
      {sugerencias.length > 0 && (
        <div className="card-soft overflow-hidden">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <TrendingDown className="h-4 w-4 shrink-0 text-orange-500" />
            <span className="text-sm font-semibold">Productos que necesitas pedir</span>
            <span className="ml-auto text-xs text-muted-foreground">{DIAS_COBERTURA} días de cobertura sugerida</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 text-left font-medium">Producto</th>
                  <th className="px-3 py-2.5 text-center font-medium">Stock</th>
                  <th className="px-3 py-2.5 text-center font-medium">Días restantes</th>
                  <th className="px-3 py-2.5 text-center font-medium">Vel. venta/día</th>
                  <th className="px-5 py-2.5 text-center font-medium">Pedir</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sugerencias.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{s.nombre}</td>
                    <td className="px-3 py-3 text-center tabular-nums">
                      <span className="font-semibold text-orange-600">{s.existencias}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {s.diasStock !== null ? (
                        <span className={s.diasStock <= 2 ? 'font-bold text-red-600' : 'text-muted-foreground'}>
                          ~{s.diasStock}d
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground tabular-nums">
                      {s.vel > 0 ? `${s.vel.toFixed(1)}/d` : '—'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {s.cantSugerida !== null ? (
                        <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                          {s.cantSugerida} {s.unidad_medida === 'pieza' ? 'u' : s.unidad_medida}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin histórico</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-5 py-3">
            <p className="text-xs text-muted-foreground">
              La columna &ldquo;Pedir&rdquo; se calcula con la velocidad de venta de los últimos 30 días × {DIAS_COBERTURA} días de cobertura.
            </p>
          </div>
        </div>
      )}

      <CompraForm
        productos={productos ?? []}
        proveedores={proveedores ?? []}
        plazas={plazas ?? []}
        plazaInicial={plazaInicial}
        hoy={hoyMX()}
      />
    </div>
  )
}
