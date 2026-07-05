import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PackageCheck, Clock, Check, X, Truck, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { requireModulo } from '@/lib/modulos'
import { getRolActual } from '@/lib/rol'
import { formatMXN } from '@/lib/dinero'
import { TZ } from '@/lib/fecha'
import { cn } from '@/lib/utils'
import NuevaEntrega from './nueva-entrega'

export const dynamic = 'force-dynamic'

function nombreDe(email: string | undefined): string {
  return email?.split('@')[0] ?? 'alguien'
}

function cuando(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

type Miembro = { user_id: string; email: string; rol: string }
type Producto = { id: string; nombre: string; existencias: number; codigo_barras: string | null }
type Local = { id: string; nombre: string; color: string }
type ItemRow = { entrega_id: string; nombre_producto: string; cantidad: number; costo_unitario: number }
type Entrega = {
  id: string
  repartidor_id: string
  entregado_por: string | null
  estado: 'pendiente' | 'confirmada' | 'rechazada'
  nota: string | null
  nota_respuesta: string | null
  creado_en: string
  local_id: string | null
}

const ESTADO_META = {
  pendiente:  { label: 'Esperando confirmación', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', Icon: Clock },
  confirmada: { label: 'Confirmada',              cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', Icon: Check },
  rechazada:  { label: 'Rechazada',               cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', Icon: X },
} as const

export default async function EntregasPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  await requireModulo('repartidores')
  const rol = await getRolActual()
  if (rol === 'repartidor') redirect('/mi-carga')

  const supabase = await createClient()

  const [{ data: miembros }, { data: productos }, { data: locales }, { data: entregas }] = await Promise.all([
    supabase.rpc('get_miembros_basico', { p_negocio_id: negocio.id }),
    supabase
      .from('productos')
      .select('id, nombre, existencias, codigo_barras')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre')
      .limit(1000),
    supabase
      .from('locales')
      .select('id, nombre, color')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('created_at'),
    supabase
      .from('entregas_repartidor')
      .select('id, repartidor_id, entregado_por, estado, nota, nota_respuesta, creado_en, local_id')
      .eq('negocio_id', negocio.id)
      .order('creado_en', { ascending: false })
      .limit(40),
  ])

  const miembrosList = (miembros as Miembro[] | null) ?? []
  const repartidores = miembrosList.filter((m) => m.rol === 'repartidor')
  const emailDe = new Map(miembrosList.map((m) => [m.user_id, m.email]))
  const nombreLocal = new Map(((locales as Local[] | null) ?? []).map((l) => [l.id, l.nombre]))

  const entregasList = (entregas as Entrega[] | null) ?? []
  const itemsPorEntrega = new Map<string, ItemRow[]>()
  if (entregasList.length > 0) {
    const { data: items } = await supabase
      .from('entregas_repartidor_items')
      .select('entrega_id, nombre_producto, cantidad, costo_unitario')
      .in('entrega_id', entregasList.map((e) => e.id))
    for (const it of (items as ItemRow[] | null) ?? []) {
      const arr = itemsPorEntrega.get(it.entrega_id) ?? []
      arr.push(it)
      itemsPorEntrega.set(it.entrega_id, arr)
    }
  }

  const plazas = (locales as Local[] | null) ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <PackageCheck className="h-5 w-5 text-primary" />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">Entregas a reparto</h1>
          <p className="text-sm text-muted-foreground">
            Registra la carga que le das a cada repartidor. Sale de tu inventario y él la confirma.
          </p>
        </div>
        <Link
          href="/reparto"
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground sm:flex"
        >
          <Truck className="h-3.5 w-3.5" /> Ver mapa
        </Link>
      </div>

      {repartidores.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 px-5 py-10 text-center">
          <Truck className="h-9 w-9 text-muted-foreground/30" />
          <div>
            <p className="font-semibold">Aún no tienes repartidores</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Crea una cuenta con rol <strong>Repartidor</strong> en{' '}
              <Link href="/configuracion" className="text-primary hover:underline">Configuración → Equipo</Link>{' '}
              y aquí podrás entregarle su carga.
            </p>
          </div>
        </div>
      ) : (
        <NuevaEntrega
          repartidores={repartidores.map((r) => ({ id: r.user_id, nombre: nombreDe(r.email) }))}
          productos={(productos as Producto[] | null) ?? []}
          plazas={plazas.length > 1 ? plazas : []}
        />
      )}

      {/* Historial */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground">Entregas recientes</h2>
        {entregasList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no has registrado entregas.</p>
        ) : (
          entregasList.map((e) => {
            const items = itemsPorEntrega.get(e.id) ?? []
            const totalUds = items.reduce((s, i) => s + i.cantidad, 0)
            const valor = items.reduce((s, i) => s + i.cantidad * i.costo_unitario, 0)
            const meta = ESTADO_META[e.estado]
            return (
              <div key={e.id} className="card-soft p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {nombreDe(emailDe.get(e.repartidor_id)).substring(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      Para {nombreDe(emailDe.get(e.repartidor_id))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cuando(e.creado_en)} · la entregó {nombreDe(emailDe.get(e.entregado_por ?? ''))}
                      {e.local_id && nombreLocal.get(e.local_id) ? ` · ${nombreLocal.get(e.local_id)}` : ''}
                    </p>
                  </div>
                  <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', meta.cls)}>
                    <meta.Icon className="h-3 w-3" /> {meta.label}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {items.map((it, idx) => (
                    <span key={idx} className="rounded-lg bg-muted/60 px-2 py-1 text-xs">
                      <span className="font-semibold tabular-nums">{it.cantidad}</span> {it.nombre_producto}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                  <span>{totalUds} unidades · {items.length} producto{items.length !== 1 ? 's' : ''}</span>
                  {valor > 0 && <span>Valor de la carga: <strong className="text-foreground">{formatMXN(valor)}</strong></span>}
                </div>

                {e.nota && <p className="mt-2 text-xs text-muted-foreground">Nota: {e.nota}</p>}
                {e.estado === 'rechazada' && e.nota_respuesta && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Motivo del rechazo: {e.nota_respuesta}</p>
                )}
              </div>
            )
          })
        )}
      </div>

      <Link href="/reparto" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:hidden">
        <ArrowLeft className="h-4 w-4" /> Volver al mapa de reparto
      </Link>
    </div>
  )
}
