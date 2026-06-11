import { redirect } from 'next/navigation'
import { getNegocioActual } from '@/lib/negocio'
import { createClient } from '@/lib/supabase/server'
import { STOCK_MINIMO } from '@/lib/constantes'
import NavBar from '@/components/nav-bar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const { count: stockBajo } = await supabase
    .from('productos')
    .select('*', { count: 'exact', head: true })
    .eq('negocio_id', negocio.id)
    .eq('activo', true)
    .lte('existencias', STOCK_MINIMO)
    .gt('existencias', 0)

  return (
    <div className="min-h-screen bg-background">
      <NavBar negocioNombre={negocio.nombre} stockBajo={stockBajo ?? 0} />
      <main className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:px-8 print:py-4">{children}</main>
    </div>
  )
}
