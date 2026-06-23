import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Building2, Calendar, Phone, Mail, MapPin } from 'lucide-react'
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

function Field({ label, value, Icon }: { label: string; value: string | null | undefined; Icon?: React.FC<{ className?: string }> }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-600 shrink-0" />}
        <p className="text-sm text-slate-200">{value || '—'}</p>
      </div>
    </div>
  )
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
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

  const { data: miembros } = await supabase
    .from('usuarios_negocio')
    .select('user_id, rol, created_at')
    .eq('negocio_id', id)
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back */}
      <Link
        href="/admin-sistema"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-white tracking-tight">{negocio.nombre}</h1>
            <EstadoBadge estado={negocio.estado_suscripcion} />
          </div>
          <p className="mt-1.5 text-sm text-slate-400">
            Alta: {fmtFecha(negocio.created_at)}
          </p>
        </div>
      </div>

      {/* Datos actuales (solo lectura, el form abajo permite editar) */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">
          Información actual
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Nombre del negocio" value={negocio.nombre} Icon={Building2} />
          <Field label="Ubicación"          value={negocio.ubicacion} Icon={MapPin} />
          <Field label="Dueño"              value={negocio.nombre_dueno} Icon={Users} />
          <Field label="Email"              value={negocio.email_dueno} Icon={Mail} />
          <Field label="Teléfono"           value={negocio.telefono_dueno} Icon={Phone} />
          <Field label="Plan"               value={
            negocio.plan === 'prueba' ? 'Prueba gratuita'
            : negocio.plan === 'mensual' ? 'Mensual'
            : negocio.plan === 'anual' ? 'Anual'
            : negocio.plan
          } />
          <Field label="Suscripción inicio" value={fmtFecha(negocio.suscripcion_inicio)} Icon={Calendar} />
          <Field label="Suscripción fin"    value={fmtFecha(negocio.suscripcion_fin)} Icon={Calendar} />
        </div>
      </div>

      {/* Formulario de edición */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-5">
          Editar datos y suscripción
        </p>
        <SuscripcionForm negocio={negocio} />
      </div>

      {/* Usuarios del negocio */}
      {(miembros ?? []).length > 0 && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="border-b border-slate-800 px-5 py-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-200">
              Usuarios ({miembros!.length})
            </p>
          </div>
          <div className="divide-y divide-slate-800">
            {miembros!.map(m => (
              <div key={m.user_id} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-slate-400 font-mono text-xs">{m.user_id.slice(0, 8)}…</span>
                <span className="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-xs font-semibold text-slate-300 capitalize">
                  {m.rol}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
