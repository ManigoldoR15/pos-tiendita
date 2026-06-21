import { requireSuperAdmin } from '@/lib/superadmin'
import { Megaphone } from 'lucide-react'
import NuevoAnuncioForm from './nuevo-form'
import ToggleAnuncioBtn from './toggle-btn'
import { fmtFechaHoraCorta } from '@/lib/fecha'
import { cn } from '@/lib/utils'

type Anuncio = {
  id: string
  titulo: string
  mensaje: string
  tipo: string
  activo: boolean
  expira_en: string | null
  created_at: string
}

export default async function AnunciosPage() {
  const { supabase } = await requireSuperAdmin()

  // Super admins ven todos (incluyendo inactivos/vencidos) vía service
  const { createServiceClient } = await import('@/lib/supabase/service')
  const admin = createServiceClient()
  const { data } = await admin
    .from('plataforma_anuncios')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const anuncios = (data as Anuncio[]) ?? []
  const activos = anuncios.filter((a) => a.activo).length

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">Anuncios de plataforma</h1>
        <p className="mt-1 text-sm text-slate-400">
          Los anuncios activos aparecen en el dashboard de <strong className="text-slate-200">todos los negocios</strong>.
          {activos > 0 && <span className="ml-1 text-emerald-400">{activos} activo{activos > 1 ? 's' : ''} ahora.</span>}
        </p>
      </div>

      {/* Formulario nuevo */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <p className="text-sm font-semibold text-slate-200 mb-4">Crear nuevo anuncio</p>
        <NuevoAnuncioForm />
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {anuncios.length === 0 && (
          <div className="py-16 text-center rounded-2xl border border-slate-800">
            <Megaphone className="mx-auto h-10 w-10 text-slate-700 mb-3" />
            <p className="text-slate-500">Sin anuncios. Crea el primero.</p>
          </div>
        )}
        {anuncios.map((a) => (
          <div
            key={a.id}
            className={cn(
              'rounded-xl border p-4 flex gap-4',
              a.activo
                ? 'border-slate-700 bg-slate-900'
                : 'border-slate-800 bg-slate-900/40 opacity-60',
            )}
          >
            <div className={cn(
              'mt-0.5 h-2.5 w-2.5 rounded-full shrink-0',
              a.tipo === 'critico' ? 'bg-red-500' : a.tipo === 'aviso' ? 'bg-amber-500' : 'bg-blue-500',
            )} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-100">{a.titulo}</p>
                <span className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  a.tipo === 'critico' ? 'bg-red-900/50 text-red-400' :
                  a.tipo === 'aviso' ? 'bg-amber-900/50 text-amber-400' :
                  'bg-blue-900/50 text-blue-400',
                )}>
                  {a.tipo}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">{a.mensaje}</p>
              <p className="text-xs text-slate-600 mt-1.5">
                {fmtFechaHoraCorta(a.created_at)}
                {a.expira_en && <> · Expira {fmtFechaHoraCorta(a.expira_en)}</>}
              </p>
            </div>
            <ToggleAnuncioBtn id={a.id} activo={a.activo} />
          </div>
        ))}
      </div>
    </div>
  )
}
