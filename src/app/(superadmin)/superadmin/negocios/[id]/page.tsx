import { notFound } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/superadmin'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHoraCorta } from '@/lib/fecha'
import Link from 'next/link'
import { ArrowLeft, Package, Users, TrendingUp, Receipt, ShoppingBag, Ban, CheckCircle } from 'lucide-react'
import SuspenderNegocioBtn from './suspender-btn'

type NegocioDetalle = {
  negocio: {
    id: string; nombre: string; email_dueno: string | null; nombre_dueno: string | null
    telefono_dueno: string | null; ubicacion: string | null; plan: string | null
    suspendido: boolean; notas_admin: string | null; created_at: string
    suscripcion_inicio: string | null; suscripcion_fin: string | null
  }
  usuarios: { email: string; rol: string; creado_en: string }[] | null
  ventas_30d: number
  num_ventas_30d: number
  ticket_promedio: number | null
  num_productos: number
  top_productos: { nombre: string; unidades: number; monto: number }[] | null
  ventas_7d: { fecha: string; total: number }[] | null
  gastos_30d: number
}

export default async function NegocioDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireSuperAdmin()

  const { data, error } = await supabase.rpc('sa_negocio_detalle', { p_id: id })
  if (error || !data) notFound()

  const d = data as NegocioDetalle
  const n = d.negocio
  const utilidad = d.ventas_30d - d.gastos_30d

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link href="/superadmin/negocios" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" /> Negocios
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-white tracking-tight">{n.nombre}</h1>
            {n.suspendido ? (
              <span className="rounded-full bg-red-900/50 border border-red-700/50 px-3 py-1 text-xs font-bold text-red-400 uppercase tracking-wide">
                Suspendido
              </span>
            ) : (
              <span className="rounded-full bg-emerald-900/40 border border-emerald-700/40 px-3 py-1 text-xs font-bold text-emerald-400 uppercase tracking-wide">
                Activo
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Registrado {fmtFechaHoraCorta(n.created_at)}
            {n.plan && ` · Plan ${n.plan}`}
          </p>
        </div>
        <SuspenderNegocioBtn negocioId={n.id} suspendido={n.suspendido} nombre={n.nombre} />
      </div>

      {/* Datos del dueño */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Información del dueño</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Nombre" value={n.nombre_dueno} />
          <Field label="Email" value={n.email_dueno} />
          <Field label="Teléfono" value={n.telefono_dueno} />
          <Field label="Ubicación" value={n.ubicacion} />
          <Field label="Suscripción inicio" value={n.suscripcion_inicio} />
          <Field label="Suscripción fin" value={n.suscripcion_fin} />
        </div>
        {n.notas_admin && (
          <div className="mt-4 rounded-lg bg-amber-950/30 border border-amber-800/30 px-4 py-3">
            <p className="text-xs font-semibold text-amber-400 mb-1">Notas admin</p>
            <p className="text-sm text-amber-200/80">{n.notas_admin}</p>
          </div>
        )}
      </div>

      {/* KPIs 30d */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ventas 30d" value={formatMXN(d.ventas_30d)} sub={`${d.num_ventas_30d} transacciones`} Icon={TrendingUp} color="text-emerald-400" />
        <KpiCard label="Ticket promedio" value={formatMXN(d.ticket_promedio ?? 0)} sub="por venta" Icon={Receipt} color="text-blue-400" />
        <KpiCard label="Gastos 30d" value={formatMXN(d.gastos_30d)} sub="del negocio" Icon={ShoppingBag} color="text-red-400" />
        <KpiCard label="Utilidad estimada" value={formatMXN(utilidad)} sub="ventas − gastos" Icon={TrendingUp} color={utilidad >= 0 ? 'text-emerald-400' : 'text-red-400'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top productos */}
        {d.top_productos && d.top_productos.length > 0 && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-200">Top productos (30 días)</p>
            </div>
            <div className="space-y-3">
              {d.top_productos.map((p, i) => {
                const max = d.top_productos![0]?.unidades ?? 1
                const pct = Math.round((p.unidades / max) * 100)
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-200 truncate">{p.nombre}</span>
                      <span className="text-slate-400 tabular-nums shrink-0 ml-2">{p.unidades} u</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Usuarios */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-200">Usuarios del negocio</p>
            <span className="ml-auto text-xs text-slate-500">
              {d.num_productos} productos activos
            </span>
          </div>
          {d.usuarios && d.usuarios.length > 0 ? (
            <div className="space-y-2">
              {d.usuarios.map((u, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-800/50 px-3 py-2.5">
                  <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                    {u.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{u.email}</p>
                    <p className="text-xs text-slate-500">{u.rol ?? 'dueño'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin usuarios registrados</p>
          )}
        </div>
      </div>

      {/* Ventas 7d mini chart */}
      {d.ventas_7d && d.ventas_7d.length > 0 && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <p className="text-sm font-semibold text-slate-200 mb-4">Ventas últimos 7 días</p>
          <div className="flex items-end gap-2 h-20">
            {d.ventas_7d.map((v, i) => {
              const max = Math.max(...d.ventas_7d!.map((x) => x.total), 1)
              const h = Math.round((v.total / max) * 100)
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-sm bg-emerald-500/80" style={{ height: `${h}%`, minHeight: v.total > 0 ? 4 : 0 }} />
                  <span className="text-[9px] text-slate-500 whitespace-nowrap">{v.fecha.slice(5)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-slate-200">{value || '—'}</p>
    </div>
  )
}

function KpiCard({ label, value, sub, Icon, color }: {
  label: string; value: string; sub: string; Icon: React.FC<{ className?: string }>; color: string
}) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      </div>
      <p className="text-xl font-black text-white tabular-nums">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}
