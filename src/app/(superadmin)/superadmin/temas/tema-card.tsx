'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Edit2, X } from 'lucide-react'
import { activarTemaAction, guardarBannerAction } from './actions'
import { cn } from '@/lib/utils'

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

export default function TemaCard({ tema, esActivo }: { tema: Tema; esActivo: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editBanner, setEditBanner] = useState(false)
  const [bannerText, setBannerText] = useState(tema.banner_texto ?? '')
  const [saved, setSaved] = useState(false)

  function activar() {
    startTransition(async () => {
      await activarTemaAction(tema.slug)
      // Fuerza recarga completa del CSS en todos los clientes
      router.refresh()
      // Hard reload para que el <style> inyectado en <head> se actualice
      window.location.reload()
    })
  }

  function saveBanner() {
    startTransition(async () => {
      await guardarBannerAction(tema.id, bannerText)
      setEditBanner(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const isDefault = tema.slug === 'default'
  const hasVars = Object.keys(tema.css_vars).length > 0
  const primaryVar = tema.css_vars['--primary'] ?? null

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all',
      esActivo
        ? 'border-emerald-600/60 bg-slate-800/80 ring-1 ring-emerald-500/30'
        : 'border-slate-800 bg-slate-900 hover:border-slate-700',
    )}>
      {/* Color preview strip */}
      <div
        className="h-2 w-full"
        style={primaryVar ? { backgroundColor: `var(--preview-color, #16a34a)`, background: primaryVar } : { background: 'linear-gradient(90deg, oklch(0.5 0.15 148), oklch(0.7 0.18 148))' }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{tema.emoji}</span>
            <div>
              <p className="font-bold text-white">{tema.nombre}</p>
              <p className="text-xs text-slate-400 mt-0.5">{tema.descripcion}</p>
            </div>
          </div>
          {esActivo && (
            <span className="shrink-0 flex items-center gap-1 rounded-full bg-emerald-900/50 border border-emerald-700/50 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
              <Check className="h-3 w-3" /> Activo
            </span>
          )}
        </div>

        {/* Banner texto */}
        {!isDefault && (
          <div className="mt-4">
            {editBanner ? (
              <div className="flex gap-2">
                <input
                  value={bannerText}
                  onChange={(e) => setBannerText(e.target.value)}
                  placeholder="Texto del banner festivo…"
                  className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-slate-500"
                />
                <button onClick={saveBanner} disabled={isPending} className="rounded-lg bg-emerald-700 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                  Guardar
                </button>
                <button onClick={() => setEditBanner(false)} className="rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-slate-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2 cursor-pointer group"
                onClick={() => setEditBanner(true)}
              >
                <span className="text-xs text-slate-400 flex-1 italic truncate">
                  {tema.banner_texto || 'Sin banner (clic para agregar)'}
                </span>
                <Edit2 className="h-3 w-3 text-slate-600 group-hover:text-slate-400 shrink-0" />
              </div>
            )}
          </div>
        )}

        {/* Colores preview */}
        {hasVars && (
          <div className="mt-3 flex gap-1.5">
            {Object.entries(tema.css_vars).slice(0, 5).map(([k, v]) => (
              <div
                key={k}
                title={`${k}: ${v}`}
                className="h-5 w-5 rounded-full border border-white/10"
                style={{ background: v }}
              />
            ))}
          </div>
        )}

        {/* Acción */}
        <button
          onClick={activar}
          disabled={isPending || (esActivo && !isDefault)}
          className={cn(
            'mt-4 w-full rounded-xl py-2 text-sm font-bold transition-colors disabled:opacity-50',
            esActivo
              ? isDefault
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                : 'bg-emerald-900/40 text-emerald-400 cursor-default'
              : 'bg-slate-700 text-white hover:bg-slate-600 active:scale-95',
          )}
        >
          {saved ? '✓ Guardado' : esActivo && !isDefault ? '✓ Activado en todas las tiendas' : isDefault && esActivo ? 'Ya en modo default' : 'Activar este tema'}
        </button>
      </div>
    </div>
  )
}
