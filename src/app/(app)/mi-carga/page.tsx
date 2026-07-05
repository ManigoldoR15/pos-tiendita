import { redirect } from 'next/navigation'
import { Truck, PackageCheck, Clock, Check, X, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { TZ } from '@/lib/fecha'
import Responder from './responder'
import AutoRefresh from '../reparto/auto-refresh'

export const dynamic = 'force-dynamic'

function nombreDe(email: string | undefined): string {
  return email?.split('@')[0] ?? 'la tienda'
}

function cuando(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

type Miembro = { user_id: string; email: string; rol: string }
type ItemRow = { entrega_id: string; nombre_producto: string; cantidad: number }
type Entrega = {
  id: string
  entregado_por: string | null
  estado: 'pendiente' | 'confirmada' | 'rechazada'
  nota: string | null
  creado_en: string
}

export default async function MiCargaPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  const rol = await getRolActual()
  if (rol !== 'repartidor') redirect('/reparto/entregas')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: entregas }, { data: miembros }] = await Promise.all([
    supabase
      .from('entregas_repartidor')
      .select('id, entregado_por, estado, nota, creado_en')
      .eq('negocio_id', negocio.id)
      .eq('repartidor_id', user.id)
      .order('creado_en', { ascending: false })
      .limit(40),
    supabase.rpc('get_miembros_basico', { p_negocio_id: negocio.id }),
  ])

  const emailDe = new Map(((miembros as Miembro[] | null) ?? []).map((m) => [m.user_id, m.email]))
  const entregasList = (entregas as Entrega[] | null) ?? []

  const itemsPorEntrega = new Map<string, ItemRow[]>()
  if (entregasList.length > 0) {
    const { data: items } = await supabase
      .from('entregas_repartidor_items')
      .select('entrega_id, nombre_producto, cantidad')
      .in('entrega_id', entregasList.map((e) => e.id))
    for (const it of (items as ItemRow[] | null) ?? []) {
      const arr = itemsPorEntrega.get(it.entrega_id) ?? []
      arr.push(it)
      itemsPorEntrega.set(it.entrega_id, arr)
    }
  }

  const pendientes = entregasList.filter((e) => e.estado === 'pendiente')
  const confirmadasHoy = entregasList.filter((e) => e.estado === 'confirmada')
  const rechazadas = entregasList.filter((e) => e.estado === 'rechazada')

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <AutoRefresh segundos={45} />
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Truck className="h-5 w-5 text-primary" />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">Mi carga</h1>
          <p className="text-sm text-muted-foreground">Confirma lo que te entregan y sal a tu ruta</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        Mientras tengas la app abierta, tu ubicación se comparte con tu jefe para trazar tu ruta. Solo durante tu jornada.
      </div>

      {/* Pendientes de confirmar */}
      {pendientes.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" /> Por confirmar ({pendientes.length})
          </h2>
          {pendientes.map((e) => {
            const items = itemsPorEntrega.get(e.id) ?? []
            const totalUds = items.reduce((s, i) => s + i.cantidad, 0)
            return (
              <div key={e.id} className="rounded-2xl border-2 border-amber-200 bg-card p-4 shadow-sm dark:border-amber-900/40">
                <p className="text-sm">
                  <strong>{nombreDe(emailDe.get(e.entregado_por ?? ''))}</strong> te entregó una carga
                </p>
                <p className="text-xs text-muted-foreground">{cuando(e.creado_en)}</p>

                <ul className="mt-3 divide-y rounded-xl border">
                  {items.map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{it.nombre_producto}</span>
                      <span className="font-bold tabular-nums">{it.cantidad}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-right text-xs text-muted-foreground">
                  Total: <strong className="text-foreground">{totalUds} unidades</strong>
                </p>
                {e.nota && (
                  <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">Nota: {e.nota}</p>
                )}

                <Responder entregaId={e.id} />
              </div>
            )
          })}
        </div>
      )}

      {/* Carga confirmada = lo que llevas */}
      {confirmadasHoy.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> Confirmada — lo que llevas
          </h2>
          {confirmadasHoy.map((e) => {
            const items = itemsPorEntrega.get(e.id) ?? []
            return (
              <div key={e.id} className="card-soft p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    De {nombreDe(emailDe.get(e.entregado_por ?? ''))} · {cuando(e.creado_en)}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Confirmada
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {items.map((it, idx) => (
                    <span key={idx} className="rounded-lg bg-muted/60 px-2 py-1 text-xs">
                      <span className="font-semibold tabular-nums">{it.cantidad}</span> {it.nombre_producto}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {rechazadas.length > 0 && (
        <div className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
            <X className="h-4 w-4" /> Rechazadas
          </h2>
          {rechazadas.map((e) => (
            <div key={e.id} className="rounded-xl border px-4 py-2.5 text-xs text-muted-foreground">
              Rechazaste la carga de {nombreDe(emailDe.get(e.entregado_por ?? ''))} · {cuando(e.creado_en)}
            </div>
          ))}
        </div>
      )}

      {entregasList.length === 0 && (
        <div className="card-soft flex flex-col items-center gap-3 px-5 py-16 text-center">
          <PackageCheck className="h-10 w-10 text-muted-foreground/30" />
          <div>
            <p className="font-semibold">No tienes cargas todavía</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Cuando el dueño o un empleado te entreguen mercancía, aparecerá aquí para que la confirmes.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
