'use client'

import { useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

export default function Buscador({
  placeholder = 'Buscar por nombre…',
  defaultValue = '',
  baseParams = {},
}: {
  placeholder?: string
  defaultValue?: string
  /** Otros filtros activos de la página que deben conservarse al buscar */
  baseParams?: Record<string, string>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [valor, setValor] = useState(defaultValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function navegar(v: string) {
    const params = new URLSearchParams(baseParams)
    const q = v.trim()
    if (q) params.set('q', q)
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`)
  }

  function onChange(v: string) {
    setValor(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => navegar(v), 350)
  }

  function limpiar() {
    if (timer.current) clearTimeout(timer.current)
    setValor('')
    navegar('')
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {valor && (
        <button
          type="button"
          onClick={limpiar}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
