'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import {
  Home, Package, Tag, ShoppingCart, Receipt, Wallet, ClipboardList,
  LogOut, Settings, Store, Truck, BarChart2, ChevronDown, Menu, X, CalendarCheck, HandCoins, Scale, Clock,
} from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import type { RolNegocio } from '@/lib/rol'

// ── Link definitions ──────────────────────────────────────────────────────────

type NavLink = { href: string; label: string; Icon: React.FC<{ className?: string }> }

const DIRECT_DUENO: NavLink[] = [
  { href: '/', label: 'Inicio', Icon: Home },
  { href: '/pos', label: 'POS', Icon: ShoppingCart },
  { href: '/corte', label: 'Caja', Icon: Wallet },
  { href: '/ventas', label: 'Ventas', Icon: ClipboardList },
  { href: '/fiados', label: 'Fiados', Icon: HandCoins },
  { href: '/cuadre', label: 'Cuadre', Icon: Scale },
  { href: '/gastos', label: 'Gastos', Icon: Receipt },
  { href: '/finanzas', label: 'Finanzas', Icon: BarChart2 },
  { href: '/caducidad', label: 'Caducidad', Icon: CalendarCheck },
  { href: '/turnos', label: 'Turnos', Icon: Clock },
]

const CATALOGO_DUENO: NavLink[] = [
  { href: '/productos', label: 'Productos', Icon: Package },
  { href: '/categorias', label: 'Categorías', Icon: Tag },
  { href: '/proveedores', label: 'Proveedores', Icon: Truck },
]

const DIRECT_ADMIN: NavLink[] = [
  { href: '/', label: 'Inicio', Icon: Home },
  { href: '/pos', label: 'POS', Icon: ShoppingCart },
  { href: '/corte', label: 'Caja', Icon: Wallet },
  { href: '/ventas', label: 'Ventas', Icon: ClipboardList },
  { href: '/fiados', label: 'Fiados', Icon: HandCoins },
  { href: '/cuadre', label: 'Cuadre', Icon: Scale },
  { href: '/gastos', label: 'Gastos', Icon: Receipt },
  { href: '/caducidad', label: 'Caducidad', Icon: CalendarCheck },
]

const CATALOGO_ADMIN: NavLink[] = [
  { href: '/productos', label: 'Productos', Icon: Package },
  { href: '/proveedores', label: 'Proveedores', Icon: Truck },
]

const DIRECT_EMPLEADO: NavLink[] = [
  { href: '/', label: 'Inicio', Icon: Home },
  { href: '/pos', label: 'POS', Icon: ShoppingCart },
  { href: '/corte', label: 'Caja', Icon: Wallet },
  { href: '/ventas', label: 'Ventas', Icon: ClipboardList },
  { href: '/fiados', label: 'Fiados', Icon: HandCoins },
  { href: '/productos', label: 'Productos', Icon: Package },
  { href: '/caducidad', label: 'Caducidad', Icon: CalendarCheck },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function NavLinkItem({
  href,
  label,
  Icon,
  active,
  badge,
}: NavLink & { active: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      className={cn(
        'relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {badge && badge > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </Link>
  )
}

function CatalogoDropdown({
  links,
  stockBajo,
  pathname,
}: {
  links: NavLink[]
  stockBajo: number
  pathname: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const anyActive = links.some(({ href }) => pathname.startsWith(href))

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
          anyActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        <Package className="h-4 w-4" />
        <span>Catálogo</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-xl border bg-card shadow-lg py-1">
          {links.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href)
            const badge = href === '/productos' ? stockBajo : 0
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'relative flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {badge > 0 && (
                  <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main NavBar ───────────────────────────────────────────────────────────────

export default function NavBar({
  negocioNombre,
  stockBajo = 0,
  lotesAlerta = 0,
  rol,
}: {
  negocioNombre: string
  stockBajo?: number
  lotesAlerta?: number
  rol?: RolNegocio | null
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isDueno = !rol || rol === 'dueno'
  const isAdmin = rol === 'administrador'

  const directLinks = isDueno ? DIRECT_DUENO : isAdmin ? DIRECT_ADMIN : DIRECT_EMPLEADO
  const catalogoLinks = isDueno ? CATALOGO_DUENO : isAdmin ? CATALOGO_ADMIN : null
  const showConfig = isDueno

  const allMobileLinks = [
    ...directLinks,
    ...(catalogoLinks ?? []),
    ...(showConfig ? [{ href: '/configuracion', label: 'Configuración', Icon: Settings }] : []),
  ]

  return (
    <header className="sticky top-0 z-40 border-b bg-card print:hidden">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-3">

        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5 mr-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Store className="h-4 w-4" />
          </span>
          <span className="hidden font-bold text-sm sm:block max-w-[140px] truncate tracking-tight">
            {negocioNombre}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex flex-1 items-center gap-0.5">
          {directLinks.map(({ href, label, Icon }) => (
            <NavLinkItem
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              active={href === '/' ? pathname === '/' : pathname.startsWith(href)}
              badge={
                href === '/productos' ? stockBajo :
                href === '/caducidad' ? lotesAlerta :
                undefined
              }
            />
          ))}

          {catalogoLinks && (
            <CatalogoDropdown
              links={catalogoLinks}
              stockBajo={stockBajo}
              pathname={pathname}
            />
          )}
        </nav>

        {/* Right actions — desktop */}
        <div className="hidden md:flex shrink-0 items-center gap-1">
          <ThemeToggle />
          {showConfig && (
            <Link
              href="/configuracion"
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
                pathname.startsWith('/configuracion')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Settings className="h-4 w-4" />
              <span>Config</span>
            </Link>
          )}
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
              <span>Salir</span>
            </Button>
          </form>
        </div>

        {/* Mobile: right side */}
        <div className="flex md:hidden ml-auto items-center gap-0.5">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menú"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-card px-4 py-3 space-y-1">
          {allMobileLinks.map(({ href, label, Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            const badge =
              href === '/productos' ? stockBajo :
              href === '/caducidad' ? lotesAlerta : 0
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {badge > 0 && (
                  <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
          <div className="pt-2 border-t">
            <form action={logoutAction}>
              <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                <LogOut className="h-4 w-4 shrink-0" />
                Salir
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}
