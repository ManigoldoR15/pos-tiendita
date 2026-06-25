'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import {
  Home, Package, Tag, ShoppingCart, Receipt, Wallet, ClipboardList,
  LogOut, Settings, Store, Truck, BarChart2, ChevronDown, X,
  CalendarCheck, HandCoins, Scale, Clock, Bell, FileText, ShoppingBag, ShieldCheck, Users, PieChart,
  Grid2X2, MapPin,
} from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import type { RolNegocio } from '@/lib/rol'
import AvisoEmpleado from '@/components/aviso-empleado'

// ── Link definitions ──────────────────────────────────────────────────────────

type NavLink = { href: string; label: string; Icon: React.FC<{ className?: string }> }

const DIRECT_DUENO: NavLink[] = [
  { href: '/', label: 'Inicio', Icon: Home },
  { href: '/pos', label: 'POS', Icon: ShoppingCart },
  { href: '/corte', label: 'Caja', Icon: Wallet },
]
const OPERACIONES_DUENO: NavLink[] = [
  { href: '/ventas', label: 'Ventas', Icon: ClipboardList },
  { href: '/clientes', label: 'Clientes', Icon: Users },
  { href: '/fiados', label: 'Fiados', Icon: HandCoins },
  { href: '/cuadre', label: 'Cuadre', Icon: Scale },
  { href: '/gastos', label: 'Gastos', Icon: Receipt },
  { href: '/compras', label: 'Compras', Icon: ShoppingBag },
]
const CATALOGO_DUENO: NavLink[] = [
  { href: '/productos', label: 'Productos', Icon: Package },
  { href: '/categorias', label: 'Categorías', Icon: Tag },
  { href: '/proveedores', label: 'Proveedores', Icon: Truck },
  { href: '/listas-precio', label: 'Listas precio', Icon: Tag },
]
const ANALISIS_DUENO: NavLink[] = [
  { href: '/finanzas', label: 'Finanzas', Icon: BarChart2 },
  { href: '/reportes', label: 'Reportes', Icon: FileText },
  { href: '/turnos', label: 'Turnos', Icon: Clock },
  { href: '/caducidad', label: 'Caducidad', Icon: CalendarCheck },
  { href: '/muestreo', label: 'Muestreo', Icon: PieChart },
  { href: '/plazas', label: 'Plazas', Icon: MapPin },
]

const DIRECT_EMPLEADO: NavLink[] = [
  { href: '/', label: 'Inicio', Icon: Home },
  { href: '/pos', label: 'POS', Icon: ShoppingCart },
  { href: '/corte', label: 'Caja', Icon: Wallet },
  { href: '/ventas', label: 'Ventas', Icon: ClipboardList },
  { href: '/clientes', label: 'Clientes', Icon: Users },
  { href: '/fiados', label: 'Fiados', Icon: HandCoins },
  { href: '/productos', label: 'Productos', Icon: Package },
]

// Bottom nav tabs (5 each)
const BOTTOM_DUENO: NavLink[] = [
  { href: '/', label: 'Inicio', Icon: Home },
  { href: '/pos', label: 'POS', Icon: ShoppingCart },
  { href: '/ventas', label: 'Ventas', Icon: ClipboardList },
  { href: '/productos', label: 'Catálogo', Icon: Package },
  { href: '/configuracion', label: 'Config', Icon: Settings },
]
const BOTTOM_EMPLEADO: NavLink[] = [
  { href: '/', label: 'Inicio', Icon: Home },
  { href: '/pos', label: 'POS', Icon: ShoppingCart },
  { href: '/ventas', label: 'Ventas', Icon: ClipboardList },
  { href: '/clientes', label: 'Clientes', Icon: Users },
  { href: '/corte', label: 'Caja', Icon: Wallet },
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

function NavDropdown({
  label,
  Icon,
  links,
  pathname,
  badges = {},
}: {
  label: string
  Icon: React.FC<{ className?: string }>
  links: NavLink[]
  pathname: string
  badges?: Record<string, number>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const anyActive = links.some(({ href }) => pathname.startsWith(href))
  const totalBadge = Object.values(badges).reduce((s, v) => s + v, 0)

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
          'relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
          anyActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform duration-150', open && 'rotate-180')} />
        {!anyActive && totalBadge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[168px] rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-[0_4px_24px_-4px_rgb(0_0_0/0.12),inset_0_0_0_0.5px_rgb(0_0_0/0.04)] py-1">
          {links.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href)
            const badge = badges[href] ?? 0
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
  notifNoLeidas = 0,
  rol,
  esSuperAdmin = false,
}: {
  negocioNombre: string
  stockBajo?: number
  lotesAlerta?: number
  notifNoLeidas?: number
  rol?: RolNegocio | null
  esSuperAdmin?: boolean
}) {
  const pathname = usePathname()
  const [masOpen, setMasOpen] = useState(false)

  const isDueno = !rol || rol === 'dueno'

  const directLinks = isDueno ? DIRECT_DUENO : DIRECT_EMPLEADO
  const operacionesLinks = isDueno ? OPERACIONES_DUENO : null
  const catalogoLinks = isDueno ? CATALOGO_DUENO : null
  const analisisLinks = isDueno ? ANALISIS_DUENO : null
  const showConfig = isDueno

  const badges: Record<string, number> = {
    '/productos': stockBajo,
    '/caducidad': lotesAlerta,
  }

  const bottomTabs = isDueno ? BOTTOM_DUENO : BOTTOM_EMPLEADO
  const bottomHrefs = new Set(bottomTabs.map((t) => t.href))

  const allLinks: NavLink[] = [
    ...directLinks,
    ...(operacionesLinks ?? []),
    ...(catalogoLinks ?? []),
    ...(analisisLinks ?? []),
    ...(isDueno ? [{ href: '/notificaciones', label: 'Notificaciones', Icon: Bell }] : []),
    ...(showConfig ? [{ href: '/configuracion', label: 'Configuración', Icon: Settings }] : []),
  ]
  const masLinks = allLinks.filter((l) => !bottomHrefs.has(l.href))

  return (
    <>
      {/* ── Top header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/90 backdrop-blur-xl print:hidden">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5 mr-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_2px_8px_-1px_rgb(0_0_0/0.20)]">
              <Store className="h-4 w-4" />
            </span>
            <span className="hidden font-semibold text-sm sm:block max-w-[140px] truncate tracking-tight">
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
                badge={badges[href]}
              />
            ))}

            {operacionesLinks && (
              <NavDropdown
                label="Operaciones"
                Icon={ClipboardList}
                links={operacionesLinks}
                pathname={pathname}
              />
            )}

            {catalogoLinks && (
              <NavDropdown
                label="Catálogo"
                Icon={Package}
                links={catalogoLinks}
                pathname={pathname}
                badges={{ '/productos': stockBajo }}
              />
            )}

            {analisisLinks && (
              <NavDropdown
                label="Análisis"
                Icon={BarChart2}
                links={analisisLinks}
                pathname={pathname}
                badges={{ '/caducidad': lotesAlerta }}
              />
            )}
          </nav>

          {/* Right actions — desktop */}
          <div className="hidden md:flex shrink-0 items-center gap-1">
            {esSuperAdmin && (
              <Link
                href="/superadmin"
                title="Panel Super Admin"
                className="flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 text-xs font-bold text-violet-500 transition-colors hover:bg-violet-500/20"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </Link>
            )}
            <ThemeToggle />
            {!isDueno && <AvisoEmpleado />}
            {isDueno && (
              <Link
                href="/notificaciones"
                title="Notificaciones"
                className={cn(
                  'relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                  pathname.startsWith('/notificaciones')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Bell className="h-4 w-4" />
                {notifNoLeidas > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                    {notifNoLeidas > 9 ? '9+' : notifNoLeidas}
                  </span>
                )}
              </Link>
            )}
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

          {/* Mobile: right side (simplified) */}
          <div className="flex md:hidden ml-auto items-center gap-0.5">
            {esSuperAdmin && (
              <Link
                href="/superadmin"
                title="Super Admin"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-violet-500"
              >
                <ShieldCheck className="h-4.5 w-4.5" />
              </Link>
            )}
            {!isDueno && <AvisoEmpleado />}
            {isDueno && (
              <Link
                href="/notificaciones"
                className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground"
              >
                <Bell className="h-5 w-5" />
                {notifNoLeidas > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                    {notifNoLeidas > 9 ? '9+' : notifNoLeidas}
                  </span>
                )}
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Mobile bottom nav ───────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl print:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex h-14 items-stretch justify-around">
          {bottomTabs.map(({ href, label, Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            const badge = badges[href] ?? 0
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'scale-110')} />
                <span>{label}</span>
                {badge > 0 && (
                  <span className="absolute right-[calc(50%-14px)] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            )
          })}

          {/* Más button */}
          <button
            type="button"
            onClick={() => setMasOpen((v) => !v)}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
              masOpen ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {masOpen ? <X className="h-5 w-5" /> : <Grid2X2 className="h-5 w-5" />}
            <span>{masOpen ? 'Cerrar' : 'Más'}</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile "Más" sheet ──────────────────────────────────────────────── */}
      {masOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setMasOpen(false)}
          />
          {/* Sheet */}
          <div
            className="fixed inset-x-0 z-40 md:hidden bg-background rounded-t-2xl border-t border-border/60 shadow-2xl overflow-y-auto"
            style={{
              bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
              maxHeight: '65vh',
            }}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-border/40 bg-background px-5 py-3">
              <span className="text-sm font-semibold">Menú</span>
              <button
                onClick={() => setMasOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 p-4">
              {masLinks.map(({ href, label, Icon }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
                const badge = badges[href] ?? 0
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMasOpen(false)}
                    className={cn(
                      'relative flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center text-xs font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="leading-tight">{label}</span>
                    {badge > 0 && (
                      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>

            <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-1">
              {esSuperAdmin && (
                <Link
                  href="/superadmin"
                  onClick={() => setMasOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-bold text-violet-500"
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Panel Super Admin
                </Link>
              )}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl bg-muted/50 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  )
}
