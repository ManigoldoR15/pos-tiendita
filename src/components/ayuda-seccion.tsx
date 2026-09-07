'use client'

import { useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { Lightbulb, X, HelpCircle, ArrowRight } from 'lucide-react'
import { getAyuda, getRutaAyuda } from '@/lib/ayuda-secciones'
import {
  snapshotAyuda, snapshotAyudaServidor, suscribirAyuda, guardarAyuda,
} from '@/lib/ayuda-estado'

/**
 * Modo tutorial: explica en cada pantalla qué es y qué se puede hacer ahí.
 *
 * Va montado una sola vez en el layout — no hay que agregar nada a las páginas.
 * Decide qué mostrar por la ruta; si la ruta no tiene texto en
 * `ayuda-secciones.ts`, no renderiza nada.
 *
 * La tarjeta se abre sola mientras el modo tutorial esté encendido y el usuario
 * no la haya cerrado en esa pantalla. El botón flotante "?" siempre está, para
 * que pueda volver a leerla cuando quiera.
 */
export default function AyudaSeccion({
  storageKey,
  rol,
}: {
  storageKey: string
  rol?: string | null
}) {
  const pathname = usePathname()
  const estado = useSyncExternalStore(
    suscribirAyuda,
    () => snapshotAyuda(storageKey),
    snapshotAyudaServidor,
  )

  // Guardamos en qué pantalla la abrió a mano: al navegar a otra, la comparación
  // deja de coincidir sola y cada ruta vuelve a decidir por su cuenta.
  const [abiertaEn, setAbiertaEn] = useState<string | null>(null)
  const abiertaManual = abiertaEn === pathname

  const ayuda = getAyuda(pathname, rol)
  const ruta = getRutaAyuda(pathname)
  if (!ayuda || !ruta) return null

  const yaCerrada = estado.cerradas.includes(ruta)
  const visible = abiertaManual || (estado.activo && !yaCerrada)

  function cerrar() {
    setAbiertaEn(null)
    if (!ruta || estado.cerradas.includes(ruta)) return
    guardarAyuda(storageKey, { ...estado, cerradas: [...estado.cerradas, ruta] })
  }

  return (
    <>
      {visible && (
        <section className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 print:hidden dark:border-amber-400/25 dark:bg-amber-400/10">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <Lightbulb className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold leading-snug text-foreground sm:text-lg">
                {ayuda.titulo}
              </h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/80">
                {ayuda.queEs}
              </p>

              <p className="mt-4 text-sm font-semibold text-foreground">Aquí puedes:</p>
              <ul className="mt-1.5 space-y-1.5">
                {ayuda.puedes.map((linea) => (
                  <li key={linea} className="flex gap-2.5 text-[15px] leading-relaxed text-foreground/80">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{linea}</span>
                  </li>
                ))}
              </ul>

              {ayuda.empiezaPor && (
                <p className="mt-4 flex gap-2.5 rounded-xl bg-background/60 p-3 text-[15px] font-medium leading-relaxed text-foreground">
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{ayuda.empiezaPor}</span>
                </p>
              )}

              <p className="mt-3 text-xs text-muted-foreground">
                Puedes volver a leer esto cuando quieras con el botón{' '}
                <span className="font-bold">?</span> de la esquina.
              </p>
            </div>

            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar la ayuda de esta pantalla"
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </section>
      )}

      {!visible && (
        <button
          type="button"
          onClick={() => setAbiertaEn(pathname)}
          aria-label={`Ver ayuda de esta pantalla: ${ayuda.titulo}`}
          title="¿Qué puedo hacer en esta pantalla?"
          className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-20 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:right-6 md:bottom-6 print:hidden"
        >
          <HelpCircle className="h-6 w-6" />
        </button>
      )}
    </>
  )
}
