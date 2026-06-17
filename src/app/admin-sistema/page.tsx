import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Store, CheckCircle, Clock, AlertCircle, XCircle, Plus } from 'lucide-react'

type NegocioRow = {
  id: string
  nombre: string
  estado_suscripcion: string
  suspendido: boolean
  plan: string
  created_at: string
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.FC<{ className?: string }>
  color: string
}) {
  return (
    <div className={`rounded-2xl border bg-card p-5 space-y-2`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export default async function AdminSistemaDashboard() {
  const supabase = await createClient()

  const { data: negocios } = await supabase.rpc('get_todos_negocios')
  const lista = (negocios ?? []) as NegocioRow[]

  const activos    = lista.filter(n => n.estado_suscripcion === 'activo').length
  const prueba     = lista.filter(n => n.estado_suscripcion === 'prueba').length
  const vencidos   = lista.filter(n => n.estado_suscripcion === 'vencido').length
  const suspendidos = lista.filter(n => n.estado_suscripcion === 'suspendido').length

  // Últimos 5 negocios dados de alta
  const recientes = lista.slice(0, 5)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel de Sistema</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lista.length} negocio{lista.length !== 1 ? 's' : ''} registrado{lista.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/admin-sistema/negocios/nuevo"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Link>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Activos"     value={activos}     icon={CheckCircle}  color="bg-green-100 text-green-700" />
        <StatCard label="En prueba"   value={prueba}      icon={Clock}        color="bg-blue-100 text-blue-700" />
        <StatCard label="Vencidos"    value={vencidos}    icon={AlertCircle}  color="bg-amber-100 text-amber-700" />
        <StatCard label="Suspendidos" value={suspendidos} icon={XCircle}      color="bg-red-100 text-red-700" />
      </div>

      {/* Recientes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Últimos clientes</h2>
          <Link href="/admin-sistema/negocios" className="text-sm text-primary hover:underline">
            Ver todos →
          </Link>
        </div>
        <div className="card-soft overflow-hidden divide-y">
          {recientes.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No hay negocios registrados aún.
            </p>
          ) : recientes.map(n => (
            <div key={n.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <Store className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">{n.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleDateString('es-MX')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <EstadoBadge estado={n.estado_suscripcion} />
                <Link
                  href={`/admin-sistema/negocios/${n.id}`}
                  className="text-xs rounded-lg border px-3 py-1 hover:bg-accent transition-colors"
                >
                  Gestionar
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    activo:     'bg-green-100 text-green-700',
    prueba:     'bg-blue-100 text-blue-700',
    vencido:    'bg-amber-100 text-amber-700',
    suspendido: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    activo: 'Activo', prueba: 'Prueba', vencido: 'Vencido', suspendido: 'Suspendido',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[estado] ?? 'bg-muted text-muted-foreground'}`}>
      {labels[estado] ?? estado}
    </span>
  )
}
