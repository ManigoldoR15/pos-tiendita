import { requireSuperAdmin } from '@/lib/superadmin'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHoraCorta } from '@/lib/fecha'
import Link from 'next/link'
import { Store, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type NegocioRow = {
  id: string
  nombre: string
  email_dueno: string | null
  nombre_dueno: string | null
  plan: string | null
  suspendido: boolean
  notas_admin: string | null
  negocio_created_at: string
  ventas_mes: number
  num_ventas_mes: number
  ultima_venta: string | null
  activo_hoy: boolean
  num_usuarios: number
}

export default async function NegociosPage() {
  const { supabase } = await requireSuperAdmin()
  const { data } = await supabase.rpc('sa_lista_negocios')
  const negocios = (data as NegocioRow[] | null) ?? []

  const activos = negocios.filter((n) => n.activo_hoy && !n.suspendido).length
  const suspendidos = negocios.filter((n) => n.suspendido).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Negocios</h1>
          <p className="mt-1 text-sm text-slate-400">
            {negocios.length} registrados · {activos} activos hoy · {suspendidos} suspendidos
          </p>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Total negocios</p>
          <p className="text-2xl font-black text-white">{negocios.length}</p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Activos hoy</p>
          <p className="text-2xl font-black text-emerald-400">{activos}</p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Suspendidos</p>
          <p className="text-2xl font-black text-red-400">{suspendidos}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Negocio</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Dueño</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ventas mes</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Estado</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Última venta</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {negocios.map((n) => (
              <tr key={n.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
                      n.suspendido ? 'bg-red-900/40 text-red-400' : 'bg-slate-800 text-slate-300',
                    )}>
                      {n.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{n.nombre}</p>
                      <p className="text-xs text-slate-500">{n.num_usuarios} usuario{n.num_usuarios !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 hidden lg:table-cell">
                  <p className="text-slate-300 truncate max-w-[180px]">{n.nombre_dueno ?? '—'}</p>
                  <p className="text-xs text-slate-500 truncate max-w-[180px]">{n.email_dueno ?? '—'}</p>
                </td>
                <td className="px-4 py-4 text-right">
                  <p className="font-bold text-slate-200 tabular-nums">{formatMXN(n.ventas_mes)}</p>
                  <p className="text-xs text-slate-500">{n.num_ventas_mes} tx</p>
                </td>
                <td className="px-4 py-4 text-center hidden md:table-cell">
                  {n.suspendido ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-900/40 px-2 py-1 text-xs font-semibold text-red-400">
                      <XCircle className="h-3 w-3" /> Suspendido
                    </span>
                  ) : n.activo_hoy ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/40 px-2 py-1 text-xs font-semibold text-emerald-400">
                      <CheckCircle className="h-3 w-3" /> Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-400">
                      <Clock className="h-3 w-3" /> Inactivo
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-right text-xs text-slate-500 hidden lg:table-cell whitespace-nowrap">
                  {n.ultima_venta ? fmtFechaHoraCorta(n.ultima_venta) : '—'}
                </td>
                <td className="px-4 py-4 text-right">
                  <Link
                    href={`/superadmin/negocios/${n.id}`}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Ver →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {negocios.length === 0 && (
          <div className="py-16 text-center">
            <Store className="mx-auto h-10 w-10 text-slate-700 mb-3" />
            <p className="text-slate-500">Sin negocios registrados</p>
          </div>
        )}
      </div>
    </div>
  )
}
