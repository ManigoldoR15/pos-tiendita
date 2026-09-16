import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

// Sin caja abierta la venta sí se guarda, pero no entra a ningún corte: el
// dinero de esas ventas no aparece al cerrar. No se bloquea el cobro (el
// cliente está enfrente), solo se avisa fuerte.
export default function AvisoSinCaja() {
  return (
    <div
      role="alert"
      className="flex shrink-0 items-start gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2.5 text-xs text-orange-900 dark:border-orange-800/50 dark:bg-orange-950/25 dark:text-orange-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <span className="font-bold">No hay caja abierta.</span> Lo que cobres no va a salir en
        el corte del día.{' '}
        <Link href="/corte" className="font-bold underline underline-offset-2">
          Abrir caja
        </Link>
      </span>
    </div>
  )
}
