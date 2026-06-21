import { requireSuperAdmin } from '@/lib/superadmin'
import TemaCard from './tema-card'

type Tema = {
  id: string
  nombre: string
  slug: string
  descripcion: string | null
  emoji: string
  activo: boolean
  banner_texto: string | null
  css_vars: Record<string, string>
}

export default async function TemasPage() {
  const { supabase } = await requireSuperAdmin()
  const { data } = await supabase
    .from('temas_estacionales')
    .select('*')
    .order('created_at')

  const temas = (data as Tema[]) ?? []
  const activo = temas.find((t) => t.activo)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">Temas estacionales</h1>
        <p className="mt-1 text-sm text-slate-400">
          Activa un tema y la interfaz de <strong className="text-slate-200">todos los negocios</strong> cambiará de paleta al instante. Solo puede estar activo un tema a la vez.
        </p>
      </div>

      {/* Tema activo */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Tema activo ahora</p>
        {activo && activo.slug !== 'default' ? (
          <div className="flex items-center gap-4">
            <div className="text-4xl">{activo.emoji}</div>
            <div>
              <p className="text-lg font-black text-white">{activo.nombre}</p>
              <p className="text-sm text-slate-400">{activo.descripcion}</p>
              {activo.banner_texto && (
                <p className="mt-1 text-xs text-slate-500 italic">Banner: &ldquo;{activo.banner_texto}&rdquo;</p>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-semibold">Activo en todas las tiendas</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-slate-400">
            <div className="text-3xl">🌿</div>
            <div>
              <p className="font-semibold text-slate-200">Verde Mexicano (Default)</p>
              <p className="text-sm">Paleta verde estándar sin modificaciones</p>
            </div>
          </div>
        )}
      </div>

      {/* Preview CSS vars */}
      {activo && Object.keys(activo.css_vars).length > 0 && (
        <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
          <p className="text-xs font-mono text-slate-500 mb-2">CSS variables inyectadas en :root</p>
          <div className="font-mono text-xs text-emerald-400 space-y-0.5">
            {Object.entries(activo.css_vars).map(([k, v]) => (
              <p key={k}><span className="text-slate-500">{k}:</span> {v};</p>
            ))}
          </div>
        </div>
      )}

      {/* Grid de temas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {temas.map((tema) => (
          <TemaCard key={tema.id} tema={tema} esActivo={tema.activo} />
        ))}
      </div>
    </div>
  )
}
