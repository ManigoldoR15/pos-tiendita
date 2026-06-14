import { redirect } from 'next/navigation'
import { getNegocioActual } from '@/lib/negocio'
import { createClient } from '@/lib/supabase/server'
import { STOCK_MINIMO } from '@/lib/constantes'
import NavBar from '@/components/nav-bar'
import { getRolActual } from '@/lib/rol'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const en3dias = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

  const [{ count: stockBajo }, rol, { count: lotesAlerta }] = await Promise.all([
    supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .lte('existencias', STOCK_MINIMO)
      .gt('existencias', 0),
    getRolActual(),
    supabase
      .from('lotes_producto')
      .select('*', { count: 'exact', head: true })
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .or(`fecha_caducidad.lte.${en3dias},estado_manual.eq.negro`),
  ])

  return (
    <div className="min-h-screen bg-background">
      <NavBar negocioNombre={negocio.nombre} stockBajo={stockBajo ?? 0} lotesAlerta={lotesAlerta ?? 0} rol={rol} />
      <main className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:px-8 print:py-4">{children}</main>
    </div>
  )
}
