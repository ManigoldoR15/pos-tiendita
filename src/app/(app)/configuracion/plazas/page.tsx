import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, ShieldCheck, BarChart2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import NuevaPlazaForm from './nueva-plaza-form'
import PlazaCard from './plaza-card'

type Local = { id: string; nombre: string; direccion: string | null; color: string; activo: boolean; created_at: string }
type NegocioExt = { max_plazas: number }

export default async function PlazasPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol !== 'dueno') redirect('/configuracion')

  const supabase = await createClient()
  const { data: locales } = await supabase
    .from('locales')
    .select('id, nombre, direccion, color, activo, created_at')
    .eq('negocio_id', negocio.id)
    .order('created_at')

  const { data: negocioExt } = await supabase
    .from('negocios')
    .select('max_plazas')
    .eq('id', negocio.id)
    .single()

  const plazas = (locales as Local[]) ?? []
  const maxPlazas = (negocioExt as NegocioExt | null)?.max_plazas ?? 1
  const numActivas = plazas.filter((p) => p.activo).length
  const limitAlcanzado = numActivas >= maxPlazas

  const primerLocalId = plazas[0]?.id ?? null

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Link href="/configuracion" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-black tracking-tight flex-1">Mis plazas</h1>
        {numActivas > 1 && (
          <Link
            href="/plazas"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Comparativo
          </Link>
        )}
      </div>

      {/* Licencia */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Licencia multi-plaza</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${limitAlcanzado ? 'bg-orange-500' : 'bg-primary'}`}
                style={{ width: `${Math.min((numActivas / maxPlazas) * 100, 100)}%` }}
              />
            </div>
          </div>
          <p className="text-sm font-bold tabular-nums shrink-0">
            {numActivas}<span className="text-muted-foreground font-normal">/{maxPlazas}</span>
          </p>
        </div>
        {limitAlcanzado && (
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
            Has alcanzado el límite de tu licencia. Contacta al soporte para ampliarla.
          </p>
        )}
      </div>

      {/* Lista de plazas */}
      <div className="space-y-3">
        {plazas.map((p, i) => (
          <PlazaCard
            key={p.id}
            plaza={{
              ...p,
              es_principal: p.id === primerLocalId && i === 0,
            }}
          />
        ))}
      </div>

      {/* Nueva plaza */}
      {!limitAlcanzado && <NuevaPlazaForm />}

      {limitAlcanzado && (
        <div className="rounded-xl border border-dashed border-orange-300 dark:border-orange-700 p-4 text-center">
          <MapPin className="mx-auto h-6 w-6 text-orange-400 mb-2" />
          <p className="text-sm text-muted-foreground">Límite de plazas alcanzado</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contacta al soporte para habilitar más plazas en tu licencia.
          </p>
        </div>
      )}
    </div>
  )
}
