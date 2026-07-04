import { redirect } from 'next/navigation'
import { getNegocioActual } from '@/lib/negocio'
import { createClient } from '@/lib/supabase/server'
import { STOCK_MINIMO } from '@/lib/constantes'
import NavBar from '@/components/nav-bar'
import GpsTracker from '@/components/gps-tracker'
import { getRolActual } from '@/lib/rol'
import { isSuperAdmin } from '@/lib/superadmin'
import { getModulos } from '@/lib/modulos'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  if (negocio.suspendido) redirect('/cuenta-suspendida')

  const supabase = await createClient()
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const en3dias = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

  const [{ count: stockBajo }, rol, { count: lotesAlerta }, { count: notifNoLeidas }, { data: temaActivo }, superAdmin, modulos] = await Promise.all([
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
    supabase
      .from('notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('negocio_id', negocio.id)
      .eq('leido', false),
    supabase
      .from('temas_estacionales')
      .select('emoji, banner_texto')
      .eq('activo', true)
      .neq('slug', 'default')
      .maybeSingle(),
    isSuperAdmin(),
    getModulos(),
  ])

  const banner = temaActivo as { emoji: string; banner_texto: string | null } | null

  // Avisos del jefe sin leer (empleados/admins): leído se controla por usuario
  let avisosNoLeidos = 0
  if (rol !== 'dueno') {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const [{ data: msgs }, { data: lecs }] = await Promise.all([
        supabase
          .from('notificaciones')
          .select('id')
          .eq('negocio_id', negocio.id)
          .eq('tipo', 'mensaje_jefe')
          .limit(100),
        supabase
          .from('notif_lecturas')
          .select('notificacion_id')
          .eq('user_id', user.id),
      ])
      const leidas = new Set((lecs ?? []).map((l) => l.notificacion_id))
      avisosNoLeidos = (msgs ?? []).filter((m) => !leidas.has(m.id)).length
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <GpsTracker />
      {banner?.banner_texto && (
        <div className="sticky top-0 z-50 bg-primary text-primary-foreground py-2 text-center text-sm font-semibold shadow-sm">
          {banner.emoji} {banner.banner_texto}
        </div>
      )}
      <NavBar
        negocioNombre={negocio.nombre}
        stockBajo={stockBajo ?? 0}
        lotesAlerta={lotesAlerta ?? 0}
        notifNoLeidas={notifNoLeidas ?? 0}
        avisosNoLeidos={avisosNoLeidos}
        rol={rol}
        esSuperAdmin={superAdmin}
        modulos={modulos}
      />
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-8 print:max-w-none print:px-8 print:py-4">{children}</main>
    </div>
  )
}
