import { redirect } from 'next/navigation'
import { Bell, Megaphone, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import MarcarLeidos from './marcar-leidos'

const TZ = 'America/Mexico_City'

type Aviso = {
  id: string
  titulo: string
  mensaje: string
  created_at: string
  destinatario_id: string | null
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default async function AvisosPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: avisos }, { data: lecturas }] = await Promise.all([
    supabase
      .from('notificaciones')
      .select('id, titulo, mensaje, created_at, destinatario_id')
      .eq('negocio_id', negocio.id)
      .eq('tipo', 'mensaje_jefe')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('notif_lecturas')
      .select('notificacion_id')
      .eq('user_id', user.id),
  ])

  const lista = (avisos ?? []) as Aviso[]
  const leidas = new Set((lecturas ?? []).map((l) => l.notificacion_id))
  const nuevos = lista.filter((a) => !leidas.has(a.id)).length

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <MarcarLeidos />

      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Avisos del jefe</h1>
          <p className="text-sm text-muted-foreground">
            {nuevos > 0
              ? `${nuevos} aviso${nuevos > 1 ? 's' : ''} nuevo${nuevos > 1 ? 's' : ''}`
              : 'Estás al día'}
          </p>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-2 px-5 py-14 text-center">
          <Megaphone className="h-8 w-8 text-muted-foreground/40" />
          <p className="font-medium">Sin avisos todavía</p>
          <p className="text-sm text-muted-foreground">
            Aquí verás los mensajes que te mande el jefe
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((a) => {
            const esNuevo = !leidas.has(a.id)
            return (
              <div
                key={a.id}
                className={`card-soft p-4 ${esNuevo ? 'border-primary/40 bg-primary/[0.04]' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {a.destinatario_id ? (
                      <><User className="h-3.5 w-3.5" /> Mensaje directo para ti</>
                    ) : (
                      <><Megaphone className="h-3.5 w-3.5" /> Para todos</>
                    )}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {esNuevo && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground uppercase">
                        Nuevo
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {fmtFecha(a.created_at)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed">{a.mensaje}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
