import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LayoutDashboard, Store, LogOut } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'

export default async function AdminSistemaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Capa 1: usuario autenticado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Capa 2: es superadmin (SECURITY DEFINER en DB, doble verificación)
  const { data: esSA } = await supabase.rpc('es_superadmin')
  if (!esSA) redirect('/')

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-4">
          <span className="flex items-center gap-2 font-bold text-sm text-primary">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
              SA
            </span>
            Panel Sistema
          </span>

          <nav className="flex items-center gap-1 ml-4">
            <Link
              href="/admin-sistema"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/admin-sistema/negocios"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              <Store className="h-4 w-4" />
              Negocios
            </Link>
          </nav>

          <div className="ml-auto">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </div>
  )
}
