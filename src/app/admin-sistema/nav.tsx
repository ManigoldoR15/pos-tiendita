'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Plus } from 'lucide-react'

export default function AsNav() {
  const pathname = usePathname()
  const isDashboard = pathname === '/admin-sistema' || (pathname.startsWith('/admin-sistema/') && !pathname.startsWith('/admin-sistema/negocios/nuevo'))

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      <Link
        href="/admin-sistema"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isDashboard
            ? 'bg-violet-600/20 text-violet-300'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white',
        )}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        Dashboard
      </Link>

      <div className="pt-4">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
          Acciones
        </p>
        <Link
          href="/admin-sistema/negocios/nuevo"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname === '/admin-sistema/negocios/nuevo'
              ? 'bg-violet-600/20 text-violet-300'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white',
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          Dar de alta cliente
        </Link>
      </div>
    </nav>
  )
}
