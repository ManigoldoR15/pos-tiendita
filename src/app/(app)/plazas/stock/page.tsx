import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Package, ArrowRight, Warehouse } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { formatUnidad } from '@/lib/dinero'
import TransferirForm, { type Lugar, type Linea } from './transferir-form'

const TZ = 'America/Mexico_City'

/** El pool global (lotes sin plaza) se maneja como un lugar más, con id '' */
const POOL: Lugar = { id: '', nombre: 'General (sin plaza)', color: '#94a3b8' }

type LoteRow = {
  producto_id: string
  variante_id: string | null
  local_id: string | null
  cantidad_actual: number
  productos: { nombre: string; unidad_medida: string } | null
  variantes_producto: { valor1: string; valor2: string | null } | null
}

type TransferenciaRow = {
  id: string
  cantidad: number
  created_at: string
  from_local_id: string | null
  to_local_id: string | null
  productos: { nombre: string; unidad_medida: string } | null
}

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default async function StockPlazaPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol && rol !== 'dueno') redirect('/')

  const supabase = await createClient()

  const [{ data: locales }, { data: lotes }, { data: movimientos }] = await Promise.all([
    supabase
      .from('locales')
      .select('id, nombre, color')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('created_at'),
    supabase
      .from('lotes_producto')
      .select('producto_id, variante_id, local_id, cantidad_actual, productos(nombre, unidad_medida), variantes_producto(valor1, valor2)')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .gt('cantidad_actual', 0),
    supabase
      .from('transferencias_inventario')
      .select('id, cantidad, created_at, from_local_id, to_local_id, productos(nombre, unidad_medida)')
      .eq('negocio_id', negocio.id)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const plazas: Lugar[] = ((locales ?? []) as Lugar[]).map((l) => ({
    id: l.id, nombre: l.nombre, color: l.color,
  }))
  // El pool va al final: es "lo que todavía no está repartido"
  const lugares: Lugar[] = [...plazas, POOL]
  const nombreLugar = (id: string | null) =>
    id === null ? POOL.nombre : (plazas.find((p) => p.id === id)?.nombre ?? 'plaza eliminada')

  // ── Agrupar lotes por línea (producto + variante) y por lugar ──────────────
  const lineas = new Map<string, Linea>()
  for (const row of ((lotes ?? []) as unknown as LoteRow[])) {
    if (!row.productos) continue
    const key = `${row.producto_id}|${row.variante_id ?? ''}`
    const variante = row.variantes_producto
    const etiqueta = variante
      ? `${row.productos.nombre} (${[variante.valor1, variante.valor2].filter(Boolean).join(' / ')})`
      : row.productos.nombre

    const linea = lineas.get(key) ?? {
      key,
      nombre: etiqueta,
      unidad: row.productos.unidad_medida,
      stock: {},
    }
    const lugarId = row.local_id ?? ''
    linea.stock[lugarId] = (linea.stock[lugarId] ?? 0) + Number(row.cantidad_actual)
    lineas.set(key, linea)
  }

  const todasLasLineas = [...lineas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-MX'))
  const lineasDe = (lugarId: string) =>
    todasLasLineas.filter((l) => (l.stock[lugarId] ?? 0) > 0)

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
            Cuánto hay en cada plaza y qué sigue sin repartir
          </p>
        </div>
      </div>

      <TransferirForm lugares={lugares} lineas={todasLasLineas} />

      {todasLasLineas.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border p-8 text-center space-y-3">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-semibold">Sin inventario</p>
            <p className="text-sm text-muted-foreground mt-1">
              Cuando recibas mercancía aparecerá aquí, repartida por plaza.
            </p>
          </div>
        </div>
      )}

      {lugares.map((lugar) => {
        const productos = lineasDe(lugar.id)
        const esPool = lugar.id === ''
        if (esPool && productos.length === 0) return null

        return (
          <div key={lugar.id || 'pool'} className="card-soft overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
              {esPool ? (
                <Warehouse className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: lugar.color }} />
              )}
              <p className="text-sm font-semibold">{lugar.nombre}</p>
              <span className="ml-auto text-xs text-muted-foreground">
                {productos.length} producto{productos.length !== 1 ? 's' : ''} con stock
              </span>
            </div>

            {esPool && (
              <p className="px-4 pt-3 text-xs text-muted-foreground">
                Mercancía que aún no está asignada a ninguna plaza. Un empleado con
                plaza asignada no puede venderla hasta que la muevas a su plaza.
              </p>
            )}

            {productos.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Sin stock asignado a esta plaza.</p>
            ) : (
              <div className="divide-y divide-border/30">
                {productos.map((l) => (
                  <div key={l.key} className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm font-medium">{l.nombre}</p>
                    <p className="text-sm font-bold tabular-nums">
                      {formatUnidad(l.stock[lugar.id] ?? 0, l.unidad)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {(movimientos ?? []).length > 0 && (
        <div className="card-soft overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-sm font-semibold">Movimientos recientes</p>
          </div>
          <div className="divide-y divide-border/30">
            {((movimientos ?? []) as unknown as TransferenciaRow[]).map((m) => (
              <div key={m.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{m.productos?.nombre ?? 'producto eliminado'}</p>
                  <p className="text-sm font-bold tabular-nums shrink-0">
                    {formatUnidad(Number(m.cantidad), m.productos?.unidad_medida ?? 'pieza')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{nombreLugar(m.from_local_id)}</span>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span>{nombreLugar(m.to_local_id)}</span>
                  <span className="ml-auto">{fechaHora(m.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
