'use client'

import { useEffect, useState } from 'react'
import { Download, ShieldCheck, AlertTriangle } from 'lucide-react'

const CLAVE = '_ultimo_respaldo'
/** A partir de una semana sin respaldar, se avisa. */
const DIAS_AVISO = 7

/**
 * Descarga del respaldo completo. La fecha del último se guarda en el propio
 * dispositivo: el punto es justamente que el respaldo viva fuera de la base, y
 * marcarlo en el servidor haría que un respaldo "existiera" según un sistema
 * que puede ser el que falle.
 */
export default function BotonRespaldo() {
  const [ultimo, setUltimo] = useState<string | null>(null)
  const [descargando, setDescargando] = useState(false)

  useEffect(() => {
    try { setUltimo(localStorage.getItem(CLAVE)) } catch {}
  }, [])

  const dias = ultimo
    ? Math.floor((Date.now() - new Date(ultimo).getTime()) / 86_400_000)
    : null
  const haceFalta = dias === null || dias >= DIAS_AVISO

  function descargar() {
    setDescargando(true)
    // Descarga directa: el navegador la maneja como cualquier archivo
    window.location.href = '/api/export/respaldo'
    const ahora = new Date().toISOString()
    try { localStorage.setItem(CLAVE, ahora) } catch {}
    setUltimo(ahora)
    setTimeout(() => setDescargando(false), 3000)
  }

  return (
    <div className="card-soft p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        <h2 className="font-semibold">Respaldo de tus datos</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Descarga todo tu negocio en un archivo: productos, inventario, ventas, clientes,
        fiados, gastos y cortes de caja. Guárdalo en tu teléfono o computadora.
        Si algún día falla el sistema, tus números siguen siendo tuyos.
      </p>

      <button
        onClick={descargar}
        disabled={descargando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        <Download className="h-4 w-4" />
        {descargando ? 'Preparando archivo…' : 'Descargar respaldo'}
      </button>

      {ultimo ? (
        <p className={`flex items-center gap-1.5 text-xs ${haceFalta ? 'font-medium text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
          {haceFalta && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          Último respaldo en este dispositivo:{' '}
          {dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`}
          {haceFalta && ' — conviene bajar uno nuevo'}
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Todavía no has descargado ningún respaldo en este dispositivo
        </p>
      )}
    </div>
  )
}
