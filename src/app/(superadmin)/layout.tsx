import { requireSuperAdmin } from '@/lib/superadmin'
import SaNav from './sa-nav'
import SaMobileHeader from './sa-mobile-header'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 border-r border-slate-800 fixed h-full z-30">
        <SaNav />
      </aside>

      {/* Content area */}
      <div className="md:ml-64 flex flex-col min-h-screen">
        <SaMobileHeader />
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
