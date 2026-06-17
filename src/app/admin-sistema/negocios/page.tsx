import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Plus, Store } from 'lucide-react'
import { EstadoBadge } from '../page'

type NegocioRow = {
  id: string
  nombre: string
  email_dueno: string | null
  nombre_dueno: string | null
  telefono_dueno: string | null
  ubicacion: string | null
  plan: string
  suscripcion_inicio: string | null
  suscripcion_fin: string | null
  suspendido: boolean
  created_at: string
  num_miembros: number
  estado_suscripcion: string
}

export default async function NegociosListaPage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_todos_negocios')
  const negocios = (data ?? []) as NegocioRow[]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Negocios clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">{negocios.length} registrados</p>
        </div>
        <Link
          href="/admin-sistema/negocios/nuevo"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Link>
      </div>

      {negocios.length === 0 ? (
        <div className="card-soft p-10 text-center text-muted-foreground">
          <p className="font-medium">Sin negocios registrados</p>
          <p className="text-sm mt-1">Da de alta tu primer cliente.</p>
        </div>
      ) : (
        <div className="card-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Negocio</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Dueño</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Plan</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Vence</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Usuarios</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {negocios.map(n => (
                <tr key={n.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Store className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{n.nombre}</p>
                        {n.ubicacion && (
                          <p className="text-xs text-muted-foreground">{n.ubicacion}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{n.nombre_dueno ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{n.email_dueno ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{n.plan}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {n.suscripcion_fin
                      ? new Date(n.suscripcion_fin).toLocaleDateString('es-MX')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <EstadoBadge estado={n.estado_suscripcion} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {n.num_miembros}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin-sistema/negocios/${n.id}`}
                      className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-accent transition-colors"
                    >
                      Gestionar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
