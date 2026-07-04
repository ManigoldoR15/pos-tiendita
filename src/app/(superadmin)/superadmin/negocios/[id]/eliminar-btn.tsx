'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { eliminarNegocioAction } from './actions'

export default function EliminarNegocioBtn({
  negocioId,
  nombre,
}: {
  negocioId: string
  nombre: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleClick() {
    const escrito = prompt(
      `⚠️ ELIMINACIÓN DEFINITIVA\n\nSe borrarán TODOS los datos del negocio: ventas, productos, clientes, empleados y sus cuentas de acceso. Esto NO se puede deshacer.\n\nEscribe el nombre del negocio para confirmar:\n"${nombre}"`,
    )
    if (escrito === null) return
    setError(null)
    startTransition(async () => {
      const res = await eliminarNegocioAction(negocioId, escrito)
      if (res && 'error' in res) {
        setError(res.error ?? 'Error desconocido.')
        return
      }
      router.push('/superadmin/negocios')
    })
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl border border-red-700/50 bg-red-900/30 px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-900/50 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        {isPending ? 'Eliminando…' : 'Eliminar negocio definitivamente'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
