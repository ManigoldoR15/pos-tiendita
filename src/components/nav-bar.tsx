'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, Tag, ShoppingCart, Receipt, Wallet, ClipboardList, LogOut, Settings, Store } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import type { RolNegocio } from '@/lib/rol'

const LINKS_DUENO = [
  { href: '/', label: 'Inicio', Icon: Home },
  { href: '/pos', label: 'POS', Icon: ShoppingCart },
  { href: '/corte', label: 'Caja', Icon: Wallet },
  { href: '/ventas', label: 'Ventas', Icon: ClipboardList },
  { href: '/gastos', label: 'Gastos', Icon: Receipt },
  { href: '/productos', label: 'Productos', Icon: Package },
  { href: '/categorias', label: 'Categorías', Icon: Tag },
  { href: '/configuracion', label: 'Config', Icon: Settings },
]

const LINKS_EMPLEADO = [
  { href: '/', label: 'Inicio', Icon: Home },
  { href: '/pos', label: 'POS', Icon: ShoppingCart },
  { href: '/corte', label: 'Caja', Icon: Wallet },
  { href: '/ventas', label: 'Ventas', Icon: ClipboardList },
  { href: '/productos', label: 'Productos', Icon: Package },
]

export default function NavBar({
  negocioNombre,
  stockBajo = 0,
  rol,
}: {
  negocioNombre: string
  stockBajo?: number
  rol?: RolNegocio | null
}) {
  const pathname = usePathname()
  const links = rol === 'empleado' ? LINKS_EMPLEADO : LINKS_DUENO

  return (
    <header className="sticky top-0 z-40 border-b bg-card shadow-sm print:hidden">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-3">
        {/* Logo / negocio */}
        <Link href="/" className="flex shrink-0 items-center gap-2 mr-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-4 w-4" />
          </span>
          <span className="hidden font-bold text-sm sm:block max-w-[130px] truncate">
            {negocioNombre}
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex flex-1 gap-0.5 overflow-x-auto scrollbar-none">
          {links.map(({ href, label, Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            const showBadge = href === '/productos' && stockBajo > 0
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{label}</span>
                {showBadge && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                    {stockBajo > 9 ? '9+' : stockBajo}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
