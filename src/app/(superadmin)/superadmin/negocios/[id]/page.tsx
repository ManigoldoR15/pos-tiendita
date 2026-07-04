import { notFound } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/superadmin'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHoraCorta } from '@/lib/fecha'
import Link from 'next/link'
import { ArrowLeft, Package, Users, TrendingUp, Receipt, ShoppingBag, Ban, CheckCircle } from 'lucide-react'
import SuspenderNegocioBtn from './suspender-btn'
import EliminarNegocioBtn from './eliminar-btn'
import LicenciaForm from './licencia-form'
import LicenciaEmpleadosForm from './licencia-empleados-form'
import LicenciaCajasForm from './licencia-cajas-form'
import ModulosForm from './modulos-form'
import SuscripcionForm from './suscripcion-form'
import PagoForm from './pago-form'
import DemoToggle from './demo-toggle'
import { hoyMX, fmtFechaCorta } from '@/lib/fecha'
import { calcEstadoCuenta, EstadoCuentaBadge, ESTADOS_CUENTA } from '../../../estados'

type Pago = {
  id: string
  fecha_pago: string
  monto: number
  plan: string
  periodo_inicio: string
  periodo_fin: string
  metodo: string
  notas: string | null
}
import { MODULOS_DEFAULT } from '@/lib/modulos-config'
import type { ModulosConfig } from '@/lib/modulos-config'

type PlazaInfo = { id: string; nombre: string; direccion: string | null; color: string; activo: boolean }

type NegocioDetalle = {
  negocio: {
    id: string; nombre: string; email_dueno: string | null; nombre_dueno: string | null
    telefono_dueno: string | null; ubicacion: string | null; plan: string | null
    suspendido: boolean; notas_admin: string | null; created_at: string
    suscripcion_inicio: string | null; suscripcion_fin: string | null
    max_plazas: number; max_empleados: number; max_cajas: number
  }
  num_plazas: number
  num_empleados: number
  num_cajas: number
  plazas: PlazaInfo[]
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

  const [{ data, error }, { data: pagosData }] = await Promise.all([
    supabase.rpc('sa_negocio_detalle', { p_id: id }),
    supabase
      .from('pagos_suscripcion')
      .select('id, fecha_pago, monto, plan, periodo_inicio, periodo_fin, metodo, notas')
      .eq('negocio_id', id)
      .order('fecha_pago', { ascending: false })
      .limit(24),
  ])
  if (error || !data) notFound()
  const pagos = (pagosData ?? []) as Pago[]
  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0)

  const d = data as NegocioDetalle
  const n = d.negocio
  const estadoCuenta = calcEstadoCuenta(n)
  const utilidad = d.ventas_30d - d.gastos_30d
  const plazas = d.plazas ?? []

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
            <EstadoCuentaBadge estado={estadoCuenta} className="px-3 py-1 text-xs uppercase tracking-wide" />
            <DemoToggle negocioId={n.id} esDemo={(n as unknown as { es_demo: boolean }).es_demo ?? false} />
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Registrado {fmtFechaHoraCorta(n.created_at)}
            {n.plan && ` · Plan ${n.plan}`}
            {` · Cuenta: ${ESTADOS_CUENTA[estadoCuenta].descr}`}
            {n.suscripcion_fin && estadoCuenta !== 'prueba' && ` (vence ${n.suscripcion_fin})`}
          </p>
        </div>
        <SuspenderNegocioBtn negocioId={n.id} suspendido={n.suspendido} nombre={n.nombre} />
      </div>

      {/* Cuenta y suscripción (editable: contacto, plan, fechas, suspensión, notas) */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Cuenta y suscripción</p>
        <SuscripcionForm
          negocio={{
            id: n.id,
            nombre: n.nombre,
            email_dueno: n.email_dueno,
            nombre_dueno: n.nombre_dueno,
            telefono_dueno: n.telefono_dueno,
            ubicacion: n.ubicacion,
            plan: n.plan ?? 'prueba',
            suscripcion_inicio: n.suscripcion_inicio,
            suscripcion_fin: n.suscripcion_fin,
            suspendido: n.suspendido,
            notas_admin: n.notas_admin,
          }}
        />
      </div>

      {/* Pagos de suscripción */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Pagos de suscripción</p>
          {pagos.length > 0 && (
            <p className="text-xs text-slate-500">
              {pagos.length} pago{pagos.length !== 1 ? 's' : ''} · total <span className="text-slate-300 font-semibold">{formatMXN(totalPagado)}</span>
            </p>
          )}
        </div>

        <PagoForm negocioId={n.id} planActual={n.plan} hoy={hoyMX()} />

        {pagos.length === 0 ? (
          <p className="text-sm text-slate-500">
            Sin pagos registrados. Al registrar el primero, el vencimiento se extiende automáticamente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 pr-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="text-right py-2 pr-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Monto</th>
                  <th className="text-left py-2 pr-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                  <th className="text-left py-2 pr-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cubre hasta</th>
                  <th className="text-left py-2 pr-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Método</th>
                  <th className="text-left py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-4 text-slate-300 whitespace-nowrap">{fmtFechaCorta(p.fecha_pago + 'T12:00:00')}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-emerald-400 tabular-nums">{formatMXN(p.monto)}</td>
                    <td className="py-2.5 pr-4 text-slate-400 capitalize">{p.plan}</td>
                    <td className="py-2.5 pr-4 text-slate-300 whitespace-nowrap">{fmtFechaCorta(p.periodo_fin + 'T12:00:00')}</td>
                    <td className="py-2.5 pr-4 text-slate-400 capitalize hidden sm:table-cell">{p.metodo}</td>
                    <td className="py-2.5 text-slate-500 hidden lg:table-cell truncate max-w-[200px]">{p.notas ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Módulos habilitados */}
      <ModulosForm
        negocioId={n.id}
        modulosActuales={{ ...MODULOS_DEFAULT, ...((n as any).modulos_habilitados as Partial<ModulosConfig> ?? {}) }}
      />

      {/* Licencias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <LicenciaForm
          negocioId={n.id}
          maxPlazas={n.max_plazas}
          numPlazas={d.num_plazas}
          plazas={plazas}
        />
        <LicenciaEmpleadosForm
          negocioId={n.id}
          maxEmpleados={n.max_empleados}
          numEmpleados={d.num_empleados}
        />
        <LicenciaCajasForm
          negocioId={n.id}
          maxCajas={n.max_cajas}
          numCajas={d.num_cajas}
        />
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

      {/* Zona de peligro */}
      <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1">Zona de peligro</p>
        <p className="text-xs text-slate-400 mb-4">
          Borra el negocio con todas sus ventas, productos, clientes, empleados y cuentas de acceso.
          Si solo quieres bloquear el acceso, usa &quot;Suspender&quot; arriba.
        </p>
        <EliminarNegocioBtn negocioId={n.id} nombre={n.nombre} />
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
