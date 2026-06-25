import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Package, ArrowRightLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { formatUnidad } from '@/lib/dinero'

type StockRow = {
  local_id: string
  local_nombre: string
  local_color: string
  producto_id: string
  producto_nombre: string
  unidad_medida: string
  stock_plaza: number
  num_lotes: number
}

type Local = { id: string; nombre: string; color: string }

export default async function StockPlazaPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol && rol !== 'dueno') redirect('/')

  const supabase = await createClient()

  const [{ data: raw }, { data: locales }] = await Promise.all([
    supabase.rpc('get_stock_por_plaza', { p_negocio_id: negocio.id }),
    supabase
      .from('locales')
      .select('id, nombre, color')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('created_at'),
  ])

  const filas: StockRow[] = (raw ?? []).map((r: Record<string, unknown>) => ({
    local_id: r.local_id as string,
    local_nombre: r.local_nombre as string,
    local_color: r.local_color as string,
    producto_id: r.producto_id as string,
    producto_nombre: r.producto_nombre as string,
    unidad_medida: r.unidad_medida as string,
    stock_plaza: Number(r.stock_plaza ?? 0),
    num_lotes: Number(r.num_lotes ?? 0),
  }))

  const plazas = (locales as Local[]) ?? []

  // Agrupar por plaza
  const porPlaza = new Map<string, { local: Local; productos: StockRow[] }>()
  for (const plaza of plazas) {
    porPlaza.set(plaza.id, { local: plaza, productos: [] })
  }
  for (const fila of filas) {
    const entry = porPlaza.get(fila.local_id)
    if (entry) entry.productos.push(fila)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Link
          href="/plazas"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">Inventario por plaza</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Solo lotes con stock asignado a cada plaza
          </p>
        </div>
      </div>

      {filas.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border p-8 text-center space-y-3">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-semibold">Sin inventario asignado a plazas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Los lotes actuales están en el pool global. Asígnalos a una plaza desde
              la pantalla de lotes del producto.
            </p>
          </div>
        </div>
      )}

      {Array.from(porPlaza.values()).map(({ local, productos }) => (
        <div key={local.id} className="card-soft overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: local.color }} />
            <p className="text-sm font-semibold">{local.nombre}</p>
            <span className="ml-auto text-xs text-muted-foreground">
              {productos.length} producto{productos.length !== 1 ? 's' : ''} con stock
            </span>
          </div>

          {productos.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Sin stock asignado a esta plaza.</p>
          ) : (
            <div className="divide-y divide-border/30">
              {productos.map((p) => (
                <div key={p.producto_id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{p.producto_nombre}</p>
                    <p className="text-xs text-muted-foreground">{p.num_lotes} lote{p.num_lotes !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="text-sm font-bold tabular-nums">
                    {formatUnidad(p.stock_plaza, p.unidad_medida)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {filas.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 flex items-start gap-3">
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Transferir inventario</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Para mover stock entre plazas, ve a la pantalla de lotes del producto
              y usa el botón de transferencia.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
