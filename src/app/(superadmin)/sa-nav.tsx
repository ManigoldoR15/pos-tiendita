'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, FlaskConical, BarChart3, Palette, Megaphone, Activity, ArrowLeft, Store,
} from 'lucide-react'

const NAV = [
  { href: '/superadmin',              label: 'Dashboard',  Icon: LayoutDashboard },
  { href: '/superadmin/negocios',     label: 'Negocios',   Icon: Store },
  { href: '/superadmin/clientes',     label: 'Clientes',   Icon: Users },
  { href: '/superadmin/accesos',      label: 'Accesos',    Icon: Activity },
  { href: '/superadmin/estudios',     label: 'Estudios',   Icon: FlaskConical },
  { href: '/superadmin/estadisticas', label: 'Mercado',    Icon: BarChart3 },
  { href: '/superadmin/temas',        label: 'Temas',      Icon: Palette },
  { href: '/superadmin/anuncios',     label: 'Anuncios',   Icon: Megaphone },
]

export default function SaNav() {
  const pathname = usePathname()

  return (
    <>
      <div className="px-5 py-5 border-b border-slate-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">POS Tiendita</p>
        <p className="text-lg font-black text-white mt-0.5">Super Admin</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">Plataforma v1</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, Icon }) => {
          const isActive = href === '/superadmin' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors hover:bg-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al POS
        </Link>
      </div>
    </>
  )
}
