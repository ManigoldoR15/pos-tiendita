'use client'

import { useSyncExternalStore } from 'react'
import { GraduationCap, RotateCcw } from 'lucide-react'
import { AYUDA_SECCIONES } from '@/lib/ayuda-secciones'
import {
  snapshotAyuda, snapshotAyudaServidor, suscribirAyuda, guardarAyuda,
} from '@/lib/ayuda-estado'

const TOTAL_SECCIONES = Object.keys(AYUDA_SECCIONES).length

/** Prende/apaga el modo tutorial y permite volver a mostrar las ayudas ya cerradas. */
export default function SwitchTutorial({ storageKey }: { storageKey: string }) {
  const estado = useSyncExternalStore(
    suscribirAyuda,
    () => snapshotAyuda(storageKey),
    snapshotAyudaServidor,
  )
  const cerradas = estado.cerradas.length

  return (
    <section className="card-soft p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold">Modo tutorial</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Explica en cada pantalla qué es y qué puedes hacer ahí. Déjalo prendido
            mientras aprendes a usar el sistema.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={estado.activo}
          aria-label="Modo tutorial"
          onClick={() => guardarAyuda(storageKey, { ...estado, activo: !estado.activo })}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
            estado.activo ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              estado.activo ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {estado.activo
          ? `La explicación se abre sola al entrar a cada pantalla. Ya cerraste ${cerradas} de ${TOTAL_SECCIONES}.`
          : 'Apagado: la explicación ya no se abre sola, pero el botón ? de la esquina sigue ahí cuando la necesites.'}
      </p>

      {cerradas > 0 && (
        <button
          type="button"
          onClick={() => guardarAyuda(storageKey, { ...estado, cerradas: [] })}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Volver a mostrar todas las explicaciones
        </button>
      )}
    </section>
  )
}
