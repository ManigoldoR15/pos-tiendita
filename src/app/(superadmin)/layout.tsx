import { requireSuperAdmin } from '@/lib/superadmin'
import SaNav from './sa-nav'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col fixed h-full">
        <SaNav />
      </aside>
      <main className="flex-1 ml-64 min-h-screen overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
