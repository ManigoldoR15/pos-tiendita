'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, Tag, ShoppingCart, Receipt, Wallet, ClipboardList, LogOut, Settings } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Inicio', Icon: Home },
  { href: '/pos', label: 'POS', Icon: ShoppingCart },
  { href: '/corte', label: 'Caja', Icon: Wallet },
  { href: '/ventas', label: 'Ventas', Icon: ClipboardList },
  { href: '/gastos', label: 'Gastos', Icon: Receipt },
  { href: '/productos', label: 'Productos', Icon: Package },
  { href: '/categorias', label: 'Categorías', Icon: Tag },
  { href: '/configuracion', label: 'Config', Icon: Settings },
]

export default function NavBar({
  negocioNombre,
  stockBajo = 0,
}: {
  negocioNombre: string
  stockBajo?: number
}) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b bg-background print:hidden">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4">
        <span className="font-bold text-sm truncate max-w-[150px]">{negocioNombre}</span>

        <nav className="flex gap-1">
          {LINKS.map(({ href, label, Icon }) => {
            const active =
              href === '/' ? pathname === '/' : pathname.startsWith(href)
            const showBadge = href === '/productos' && stockBajo > 0
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                {showBadge && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                    {stockBajo > 9 ? '9+' : stockBajo}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </form>
      </div>
    </header>
  )
}
