import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogOut } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import AsNav from './nav'

export default async function AdminSistemaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: esSA } = await supabase.rpc('es_superadmin')
  if (!esSA) redirect('/')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      {/* Sidebar fija */}
      <aside className="w-56 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col fixed h-full z-10">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white text-[11px] font-black tracking-tight">
              SA
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-none mb-0.5">
                POS Tiendita
              </p>
              <p className="text-sm font-black text-white leading-none">Admin Sistema</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-[10px] text-violet-400 font-medium">Panel de operador</span>
          </div>
        </div>

        {/* Nav */}
        <AsNav />

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 ml-56 min-h-screen">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
