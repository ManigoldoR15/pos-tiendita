import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EstadoBadge } from '../../page'
import SuscripcionForm from './suscripcion-form'

type NegocioDetalle = {
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
  notas_admin: string | null
  created_at: string
  num_miembros: number
  estado_suscripcion: string
}

export default async function NegocioDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase.rpc('get_todos_negocios')
  const negocio = ((data ?? []) as NegocioDetalle[]).find(n => n.id === id)
  if (!negocio) notFound()

  // Miembros del negocio
  const { data: miembros } = await supabase
    .from('usuarios_negocio')
    .select('user_id, rol, created_at')
    .eq('negocio_id', id)
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin-sistema/negocios"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Negocios
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{negocio.nombre}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alta: {new Date(negocio.created_at).toLocaleDateString('es-MX')}
          </p>
        </div>
        <EstadoBadge estado={negocio.estado_suscripcion} />
      </div>

      <SuscripcionForm negocio={negocio} />

      {/* Miembros */}
      {(miembros ?? []).length > 0 && (
        <section className="card-soft overflow-hidden">
          <div className="border-b bg-muted/30 px-5 py-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">
              Usuarios ({miembros!.length})
            </h2>
          </div>
          <div className="divide-y">
            {miembros!.map(m => (
              <div key={m.user_id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-muted-foreground font-mono text-xs">{m.user_id.slice(0, 8)}…</span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold capitalize">
                  {m.rol}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
