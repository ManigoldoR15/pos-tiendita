import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Store, CheckCircle, Clock, AlertCircle, XCircle, Calendar, MapPin, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

type NegocioRow = {
  id: string
  nombre: string
  email_dueno: string | null
  nombre_dueno: string | null
  telefono_dueno: string | null
  ubicacion: string | null
  plan: string
  suscripcion_fin: string | null
  created_at: string
  num_miembros: number
  estado_suscripcion: string
}

export function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    activo:     'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40',
    prueba:     'bg-blue-900/40 text-blue-400 border border-blue-700/40',
    vencido:    'bg-amber-900/40 text-amber-400 border border-amber-700/40',
    suspendido: 'bg-red-900/40 text-red-400 border border-red-700/40',
  }
  const labels: Record<string, string> = {
    activo: 'Activo', prueba: 'Prueba', vencido: 'Vencido', suspendido: 'Suspendido',
  }
  return (
    <span className={cn(
      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
      styles[estado] ?? 'bg-slate-800 text-slate-400 border border-slate-700',
    )}>
      {labels[estado] ?? estado}
    </span>
  )
}

function planLabel(plan: string) {
  if (plan === 'prueba') return 'Prueba gratuita'
  if (plan === 'mensual') return 'Mensual'
  if (plan === 'anual') return 'Anual'
  return plan
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default async function AdminSistemaDashboard({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>
}) {
  const supabase = await createClient()
  const sp = await searchParams

  const { data } = await supabase.rpc('get_todos_negocios')
  const todosList = (data ?? []) as NegocioRow[]

  // Métricas sobre la lista completa
  const total       = todosList.length
  const activos     = todosList.filter(n => n.estado_suscripcion === 'activo').length
  const prueba      = todosList.filter(n => n.estado_suscripcion === 'prueba').length
  const vencidos    = todosList.filter(n => n.estado_suscripcion === 'vencido').length
  const suspendidos = todosList.filter(n => n.estado_suscripcion === 'suspendido').length
  const ahora       = new Date()
  const inicioMes   = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const nuevosMes   = todosList.filter(n => new Date(n.created_at) >= inicioMes).length

  // Filtros aplicados sobre copia
  let lista = [...todosList]
  if (sp.q) {
    const q = sp.q.toLowerCase()
    lista = lista.filter(n =>
      n.nombre.toLowerCase().includes(q) ||
      n.email_dueno?.toLowerCase().includes(q) ||
      n.nombre_dueno?.toLowerCase().includes(q),
    )
  }
  if (sp.estado && sp.estado !== 'todos') {
    lista = lista.filter(n => n.estado_suscripcion === sp.estado)
  }

  const hayFiltros = !!(sp.q || (sp.estado && sp.estado !== 'todos'))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
            POS Tiendita · Sistema
          </p>
          <h1 className="text-2xl font-black text-white tracking-tight">Negocios clientes</h1>
          <p className="mt-1 text-sm text-slate-400">
            {total} registrado{total !== 1 ? 's' : ''} en la plataforma
          </p>
        </div>
        <Link
          href="/admin-sistema/negocios/nuevo"
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Dar de alta negocio
        </Link>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total',        value: total,       color: 'text-slate-200',   Icon: Store,         dot: 'bg-slate-500' },
          { label: 'Activos',      value: activos,     color: 'text-emerald-400', Icon: CheckCircle,   dot: 'bg-emerald-400' },
          { label: 'En prueba',    value: prueba,      color: 'text-blue-400',    Icon: Clock,         dot: 'bg-blue-400' },
          { label: 'Vencidos',     value: vencidos,    color: 'text-amber-400',   Icon: AlertCircle,   dot: 'bg-amber-400' },
          { label: 'Suspendidos',  value: suspendidos, color: 'text-red-400',     Icon: XCircle,       dot: 'bg-red-400' },
          { label: 'Nuevos / mes', value: nuevosMes,   color: 'text-violet-400',  Icon: Calendar,      dot: 'bg-violet-400' },
        ].map(({ label, value, color, Icon, dot }) => (
          <div key={label} className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn('h-1.5 w-1.5 rounded-full', dot)} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
            </div>
            <p className={cn('text-2xl font-black tabular-nums', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3 items-center">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Buscar negocio, dueño, email…"
          className="flex-1 min-w-52 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <select
          name="estado"
          defaultValue={sp.estado ?? 'todos'}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="prueba">En prueba</option>
          <option value="vencido">Vencidos</option>
          <option value="suspendido">Suspendidos</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition-colors"
        >
          Filtrar
        </button>
        {hayFiltros && (
          <Link href="/admin-sistema" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Limpiar filtros
          </Link>
        )}
      </form>

      {/* Tabla */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <p className="text-xs text-slate-500">
            {hayFiltros
              ? `${lista.length} resultado${lista.length !== 1 ? 's' : ''} con filtros aplicados`
              : `${lista.length} negocio${lista.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Negocio
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  Dueño / Contacto
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                  Fecha de alta
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                  Vencimiento
                </th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {lista.map(n => {
                const vencida = n.suscripcion_fin && new Date(n.suscripcion_fin) < ahora
                return (
                  <tr key={n.id} className="hover:bg-slate-800/40 transition-colors group">
                    {/* Negocio */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
                          n.estado_suscripcion === 'suspendido'
                            ? 'bg-red-900/40 text-red-400'
                            : 'bg-violet-900/40 text-violet-300',
                        )}>
                          {n.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{n.nombre}</p>
                          <p className="text-[10px] text-slate-500">
                            {planLabel(n.plan)}
                            {' · '}
                            <span className="inline-flex items-center gap-0.5">
                              <Users className="h-2.5 w-2.5" />
                              {n.num_miembros}
                            </span>
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Dueño */}
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <p className="text-slate-300 truncate max-w-[180px]">{n.nombre_dueno ?? '—'}</p>
                      <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {n.email_dueno ?? n.telefono_dueno ?? '—'}
                      </p>
                    </td>

                    {/* Fecha alta */}
                    <td className="px-4 py-3.5 text-sm text-slate-400 hidden lg:table-cell whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-slate-600" />
                        {fmtFecha(n.created_at)}
                      </div>
                    </td>

                    {/* Vencimiento */}
                    <td className="px-4 py-3.5 text-sm hidden lg:table-cell whitespace-nowrap">
                      {n.suscripcion_fin ? (
                        <span className={vencida ? 'text-amber-400 font-medium' : 'text-slate-400'}>
                          {fmtFecha(n.suscripcion_fin)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3.5 text-center">
                      <EstadoBadge estado={n.estado_suscripcion} />
                    </td>

                    {/* Acción */}
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin-sistema/negocios/${n.id}`}
                        className="text-xs text-slate-500 group-hover:text-violet-400 font-medium transition-colors"
                      >
                        Gestionar →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {lista.length === 0 && (
            <div className="py-16 text-center">
              <Store className="mx-auto h-10 w-10 text-slate-700 mb-3" />
              <p className="text-slate-500">
                {hayFiltros ? 'Sin resultados para estos filtros' : 'No hay negocios registrados aún'}
              </p>
              {!hayFiltros && (
                <Link
                  href="/admin-sistema/negocios/nuevo"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Dar de alta el primer cliente
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
