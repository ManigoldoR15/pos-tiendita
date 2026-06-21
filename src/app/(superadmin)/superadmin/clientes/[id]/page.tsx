import { notFound } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/superadmin'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHoraCorta } from '@/lib/fecha'
import { tipoLabel } from '@/lib/tipos-negocio'
import Link from 'next/link'
import {
  ArrowLeft, Package, Users, TrendingUp, Receipt, ShoppingBag,
  MapPin, ShieldCheck, Shield, Phone, Mail,
} from 'lucide-react'
import SuspenderNegocioBtn from '../../negocios/[id]/suspender-btn'
import NotasAdmin from './notas-admin'

type NegocioDetalle = {
  negocio: {
    id: string; nombre: string; email_dueno: string | null; nombre_dueno: string | null
    telefono_dueno: string | null; ubicacion: string | null; plan: string | null
    suspendido: boolean; notas_admin: string | null; created_at: string
    suscripcion_inicio: string | null; suscripcion_fin: string | null
    tipo_negocio?: string; ciudad?: string | null; estado_mx?: string | null
    inscrito_sat?: boolean
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

export default async function ClienteDetallePage({
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
      <Link href="/superadmin/clientes" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
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
            {n.tipo_negocio && (
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
                {tipoLabel(n.tipo_negocio)}
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

      {/* Info del dueño + perfil */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contacto */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contacto del dueño</p>
          <div className="space-y-3">
            <ContactRow Icon={Users} label="Nombre" value={n.nombre_dueno} />
            <ContactRow Icon={Mail} label="Email" value={n.email_dueno} />
            <ContactRow Icon={Phone} label="Teléfono" value={n.telefono_dueno} />
            <ContactRow Icon={MapPin} label="Ubicación" value={
              n.ciudad && n.estado_mx
                ? `${n.ciudad}, ${n.estado_mx}`
                : n.estado_mx ?? n.ubicacion
            } />
          </div>
        </div>

        {/* Perfil del negocio */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Perfil del negocio</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Tipo</span>
              <span className="text-sm text-slate-200">{n.tipo_negocio ? tipoLabel(n.tipo_negocio) : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Ciudad</span>
              <span className="text-sm text-slate-200">{n.ciudad ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Estado</span>
              <span className="text-sm text-slate-200">{n.estado_mx ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">SAT</span>
              {n.inscrito_sat ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> Inscrito en el SAT
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Shield className="h-3.5 w-3.5" /> Informal
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Plan</span>
              <span className="text-sm text-slate-200 capitalize">{n.plan ?? '—'}</span>
            </div>
          </div>
        </div>
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
              <span className="ml-auto text-xs text-slate-500">{d.num_productos} en catálogo</span>
            </div>
            <div className="space-y-3">
              {d.top_productos.map((p, i) => {
                const max = d.top_productos![0]?.unidades ?? 1
                const pct = Math.round((p.unidades / max) * 100)
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-200 truncate">{p.nombre}</span>
                      <span className="text-slate-400 tabular-nums shrink-0 ml-2">{p.unidades} u · {formatMXN(p.monto)}</span>
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

        {/* Usuarios del negocio */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-200">Equipo del negocio</p>
          </div>
          {d.usuarios && d.usuarios.length > 0 ? (
            <div className="space-y-2">
              {d.usuarios.map((u, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-800/50 px-3 py-2.5">
                  <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                    {u.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{u.email}</p>
                    <p className="text-xs text-slate-500 capitalize">{u.rol ?? 'dueño'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin usuarios registrados</p>
          )}
        </div>
      </div>

      {/* Ventas 7d */}
      {d.ventas_7d && d.ventas_7d.length > 0 && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <p className="text-sm font-semibold text-slate-200 mb-4">Ventas últimos 7 días</p>
          <div className="flex items-end gap-2 h-20">
            {d.ventas_7d.map((v, i) => {
              const max = Math.max(...d.ventas_7d!.map((x) => x.total), 1)
              const h = Math.round((v.total / max) * 100)
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
                  <div
                    className="w-full rounded-sm bg-emerald-500/80 group-hover/bar:bg-emerald-400 transition-colors"
                    style={{ height: `${h}%`, minHeight: v.total > 0 ? 4 : 0 }}
                    title={formatMXN(v.total)}
                  />
                  <span className="text-[9px] text-slate-500 whitespace-nowrap">{v.fecha.slice(5)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notas del admin */}
      <NotasAdmin negocioId={n.id} notasActuales={n.notas_admin} />
    </div>
  )
}

function ContactRow({ Icon, label, value }: {
  Icon: React.FC<{ className?: string }>; label: string; value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500">{label}</p>
        <p className="text-sm text-slate-200 break-all">{value ?? '—'}</p>
      </div>
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
