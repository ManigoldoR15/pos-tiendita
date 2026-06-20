import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHora, fmtFechaCorta } from '@/lib/fecha'
import VentasExpandibles from './ventas-expandibles'
import TicketTurno from './ticket-turno'

function emailCajero(email: string | null) {
  return email ? email.split('@')[0] : '—'
}

function BadgeRol({ rol }: { rol: string }) {
  const colors: Record<string, string> = {
    dueno: 'bg-primary/10 text-primary',
    administrador: 'bg-blue-100 text-blue-700',
    empleado: 'bg-muted text-muted-foreground',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colors[rol] ?? colors.empleado}`}>
      {rol}
    </span>
  )
}

type ItemRaw = {
  id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  productos: { nombre: string; unidad_medida: string } | null
}

type VentaRaw = {
  id: string
  created_at: string
  total: number
  es_fiado: boolean
  metodos_pago: { nombre: string } | null
  clientes: { nombre: string } | null
  venta_items: ItemRaw[]
}

export default async function TurnoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()

  // Turno header via SECURITY DEFINER (checks dueño role at DB level)
  const { data: turnoArr } = await supabase.rpc('get_turno_detalle', { p_corte_id: id })
  const t = turnoArr?.[0]
  if (!t) notFound()

  // Ventas del turno + items
  const { data: ventasRaw } = await supabase
    .from('ventas')
    .select(`
      id, created_at, total, es_fiado,
      metodos_pago(nombre),
      clientes(nombre),
      venta_items(id, cantidad, precio_unitario, subtotal, productos(nombre, unidad_medida))
    `)
    .eq('corte_id', id)
    .eq('negocio_id', negocio.id)
    .eq('estado', 'completada')
    .order('created_at', { ascending: true })

  // Ajustes de inventario durante el turno
  const { data: ajustes } = await supabase
    .from('ajustes_inventario')
    .select('id, delta, cantidad_antes, cantidad_despues, motivo, notas, created_at, productos(nombre, unidad_medida)')
    .eq('negocio_id', negocio.id)
    .gte('created_at', t.fecha_apertura)
    .lte('created_at', t.fecha_cierre)
    .order('created_at', { ascending: true })

  // Normalize ventas
  const ventas = (ventasRaw ?? []).map((v) => {
    const raw = v as unknown as VentaRaw
    return {
      id: raw.id,
      created_at: raw.created_at,
      total: raw.total,
      es_fiado: raw.es_fiado,
      metodo_pago: raw.metodos_pago?.nombre ?? null,
      cliente_nombre: raw.clientes?.nombre ?? null,
      items: (raw.venta_items ?? []).map((it) => ({
        id: it.id,
        nombre: it.productos?.nombre ?? 'Producto eliminado',
        cantidad: Number(it.cantidad),
        precio_unitario: it.precio_unitario,
        subtotal: it.subtotal,
        unidad_medida: it.productos?.unidad_medida,
      })),
    }
  })

  // Aggregate products sold (for print detallado)
  const prodMap = new Map<string, { nombre: string; unidad_medida: string; cantidad_total: number; total_mxn: number }>()
  for (const v of ventas) {
    for (const it of v.items) {
      const key = it.nombre
      const prev = prodMap.get(key) ?? { nombre: it.nombre, unidad_medida: it.unidad_medida ?? 'pieza', cantidad_total: 0, total_mxn: 0 }
      prodMap.set(key, {
        ...prev,
        cantidad_total: prev.cantidad_total + it.cantidad,
        total_mxn: prev.total_mxn + it.subtotal,
      })
    }
  }
  const productosResumen = Array.from(prodMap.values()).sort((a, b) => b.total_mxn - a.total_mxn)

  const fiados = ventas.filter(v => v.es_fiado)
  const diferencia = Number(t.diferencia ?? 0)
  const difColor = diferencia === 0 ? 'text-foreground' : diferencia > 0 ? 'text-blue-600' : 'text-red-600'

  const turnoProps = {
    id: t.id as string,
    apertura_email: (t.apertura_email as string) ?? '',
    apertura_rol: (t.apertura_rol as string) ?? 'desconocido',
    cierre_email: (t.cierre_email as string | null) ?? null,
    cierre_rol: (t.cierre_rol as string | null) ?? null,
    abierto_por: t.abierto_por as string,
    cerrado_por: (t.cerrado_por as string | null) ?? null,
    fecha_apertura: t.fecha_apertura as string,
    fecha_cierre: t.fecha_cierre as string,
    monto_inicial: t.monto_inicial as number,
    monto_esperado: t.monto_esperado as number | null,
    monto_contado: t.monto_contado as number | null,
    diferencia: t.diferencia as number | null,
    duracion_min: Number(t.duracion_min),
    total_ventas: Number(t.total_ventas),
    num_ventas: Number(t.num_ventas),
    ventas_efectivo: Number(t.ventas_efectivo),
    ventas_otros: Number(t.ventas_otros),
    total_fiado: Number(t.total_fiado),
    negocioNombre: negocio.nombre,
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back + print */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href="/turnos"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Turnos
        </Link>
        <TicketTurno turno={turnoProps} productos={productosResumen} />
      </div>

      {/* ── SECCIÓN 1: Quién y cuándo ─────────────────────────── */}
      <section className="card-soft overflow-hidden">
        <div className="border-b bg-muted/30 px-5 py-4">
          <h2 className="font-semibold">Información del turno</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            ID: {(t.id as string).slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
          <div>
            <p className="eyebrow text-[10px] mb-1">Abrió</p>
            <p className="font-semibold">{emailCajero(t.apertura_email as string)}</p>
            <BadgeRol rol={t.apertura_rol as string} />
          </div>
          <div>
            <p className="eyebrow text-[10px] mb-1">Cerró</p>
            {t.cerrado_por ? (
              <>
                <p className="font-semibold">{emailCajero(t.cierre_email as string | null)}</p>
                <BadgeRol rol={t.cierre_rol as string} />
              </>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div>
            <p className="eyebrow text-[10px] mb-1">Apertura</p>
            <p className="text-sm">{fmtFechaHora(t.fecha_apertura as string)}</p>
          </div>
          <div>
            <p className="eyebrow text-[10px] mb-1">Cierre · {Number(t.duracion_min)} min</p>
            <p className="text-sm">{fmtFechaHora(t.fecha_cierre as string)}</p>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 2: Resumen monetario ────────────────────────── */}
      <section className="card-soft overflow-hidden">
        <div className="border-b bg-muted/30 px-5 py-4">
          <h2 className="font-semibold">Resumen de caja</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-muted/30 p-4">
              <p className="eyebrow text-[10px] mb-1">Fondo inicial</p>
              <p className="text-xl font-black tracking-tight tabular-nums">{formatMXN(t.monto_inicial as number)}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-4">
              <p className="eyebrow text-[10px] mb-1">Ventas efectivo</p>
              <p className="text-xl font-black tracking-tight tabular-nums">{formatMXN(Number(t.ventas_efectivo))}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-4">
              <p className="eyebrow text-[10px] mb-1">Otros métodos</p>
              <p className="text-xl font-black tracking-tight tabular-nums">{formatMXN(Number(t.ventas_otros))}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-4">
              <p className="eyebrow text-[10px] mb-1">Total ventas</p>
              <p className="text-xl font-black tracking-tight tabular-nums">{formatMXN(Number(t.total_ventas))}</p>
            </div>
          </div>

          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fondo + ventas efectivo</span>
              <span className="tabular-nums font-medium">{formatMXN(Number(t.monto_esperado ?? 0))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monto contado físicamente</span>
              <span className="tabular-nums font-medium">{formatMXN(Number(t.monto_contado ?? 0))}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Diferencia</span>
              <span className={`tabular-nums ${difColor}`}>
                {diferencia === 0
                  ? 'Sin diferencia'
                  : `${diferencia > 0 ? '+' : ''}${formatMXN(diferencia)}`}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 3: Ventas del turno ────────────────────────── */}
      <section className="card-soft overflow-hidden">
        <div className="border-b bg-muted/30 px-5 py-4 flex items-center justify-between">
          <h2 className="font-semibold">Ventas del turno</h2>
          <span className="text-sm text-muted-foreground">{ventas.length} transacciones</span>
        </div>
        <VentasExpandibles ventas={ventas} />
      </section>

      {/* ── SECCIÓN 4: Fiados ──────────────────────────────────── */}
      {fiados.length > 0 && (
        <section className="card-soft overflow-hidden">
          <div className="border-b bg-muted/30 px-5 py-4 flex items-center justify-between">
            <h2 className="font-semibold">Fiados del turno</h2>
            <span className="text-sm text-amber-600 font-medium">{formatMXN(Number(t.total_fiado))} pendiente</span>
          </div>
          <div className="divide-y">
            {fiados.map(v => (
              <div key={v.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-sm">{v.cliente_nombre ?? 'Anónimo'}</p>
                  <p className="text-xs text-muted-foreground">{fmtFechaCorta(v.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{formatMXN(v.total)}</span>
                  <Link
                    href={`/fiados`}
                    className="text-xs text-primary hover:underline"
                  >
                    Ver fiado →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── SECCIÓN 5: Ajustes de inventario ──────────────────── */}
      {(ajustes ?? []).length > 0 && (
        <section className="card-soft overflow-hidden">
          <div className="border-b bg-muted/30 px-5 py-4">
            <h2 className="font-semibold">Ajustes de inventario durante el turno</h2>
          </div>
          <div className="divide-y">
            {(ajustes ?? []).map((aj) => {
              const prod = aj.productos as unknown as { nombre: string; unidad_medida: string } | null
              const delta = Number(aj.delta)
              return (
                <div key={aj.id} className="flex items-start justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{prod?.nombre ?? 'Producto eliminado'}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtFechaCorta(aj.created_at)} · {aj.motivo}
                      {aj.notas ? ` · ${aj.notas}` : ''}
                    </p>
                  </div>
                  <p className={`font-bold tabular-nums ${delta < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {delta > 0 ? '+' : ''}
                    {delta.toLocaleString('es-MX', { maximumFractionDigits: 3 })}
                    {prod?.unidad_medida && prod.unidad_medida !== 'pieza' ? ` ${prod.unidad_medida}` : ''}
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
