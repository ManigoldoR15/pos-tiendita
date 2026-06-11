import { redirect } from 'next/navigation'
import { getNegocioActual } from '@/lib/negocio'
import NavBar from '@/components/nav-bar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  return (
    <div className="min-h-screen bg-background">
      <NavBar negocioNombre={negocio.nombre} />
      <main className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:px-8 print:py-4">{children}</main>
    </div>
  )
}
