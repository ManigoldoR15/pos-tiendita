'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Menu, X, ArrowLeft,
  LayoutDashboard, Users, FlaskConical, BarChart3, Palette, Megaphone, Activity,
} from 'lucide-react'

const NAV = [
  { href: '/superadmin',              label: 'Dashboard',    Icon: LayoutDashboard },
  { href: '/superadmin/clientes',     label: 'Clientes',     Icon: Users },
  { href: '/superadmin/accesos',      label: 'Accesos',      Icon: Activity },
  { href: '/superadmin/estudios',     label: 'Estudios',     Icon: FlaskConical },
  { href: '/superadmin/estadisticas', label: 'Mercado',      Icon: BarChart3 },
  { href: '/superadmin/temas',        label: 'Temas',        Icon: Palette },
  { href: '/superadmin/anuncios',     label: 'Anuncios',     Icon: Megaphone },
]

export default function SaMobileHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const current = NAV.find((n) =>
    n.href === '/superadmin' ? pathname === n.href : pathname.startsWith(n.href),
  )

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-800 bg-slate-900 px-4">
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Super Admin</p>
          <p className="text-sm font-bold text-white leading-tight truncate">
            {current?.label ?? 'Dashboard'}
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          POS
        </Link>
      </div>

      {/* Overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-900 border-r border-slate-800 shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">POS Tiendita</p>
                <p className="text-base font-black text-white mt-0.5">Super Admin</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium">Plataforma v1</span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
              {NAV.map(({ href, label, Icon }) => {
                const isActive =
                  href === '/superadmin' ? pathname === href : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
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

            {/* Footer */}
            <div className="border-t border-slate-800 p-4">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver al POS
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
