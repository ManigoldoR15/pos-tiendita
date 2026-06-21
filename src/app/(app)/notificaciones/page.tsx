import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Bell, AlertTriangle, CalendarX, ClipboardList,
  Wallet, HandCoins, MessageSquare, CheckCheck, Megaphone,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { STOCK_MINIMO } from '@/lib/constantes'
import { fmtFechaHoraCorta } from '@/lib/fecha'
import { cn } from '@/lib/utils'
import { marcarLeidoAction, marcarTodasLeidasAction } from './actions'

type Notif = {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  url: string | null
  leido: boolean
  leido_en: string | null
  creado_por: string | null
  created_at: string
}

const TIPO_META: Record<string, { Icon: React.FC<{ className?: string }>; color: string }> = {
  ajuste_inventario: { Icon: ClipboardList, color: 'text-blue-500' },
  diferencia_caja:  { Icon: Wallet,        color: 'text-red-500'  },
  fiado:            { Icon: HandCoins,     color: 'text-amber-500'},
  fiado_lista_negra:{ Icon: HandCoins,     color: 'text-red-600'  },
  mensaje_empleado: { Icon: MessageSquare, color: 'text-violet-500'},
  mensaje_jefe:     { Icon: Megaphone,     color: 'text-blue-500'  },
}

function NotifRow({ notif }: { notif: Notif }) {
  const meta = TIPO_META[notif.tipo] ?? { Icon: Bell, color: 'text-muted-foreground' }
  const { Icon, color } = meta

  return (
    <div className={cn(
      'flex items-start gap-4 px-5 py-4 transition-colors',
      !notif.leido && 'bg-primary/[0.03]',
    )}>
      <div className={cn('mt-0.5 shrink-0', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium', !notif.leido && 'font-semibold')}>
            {notif.titulo}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
            {fmtFechaHoraCorta(notif.created_at)}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground leading-snug">{notif.mensaje}</p>
        <div className="mt-2 flex items-center gap-3">
          {notif.url && notif.url !== '/notificaciones' && (
            <Link
              href={notif.url}
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver →
            </Link>
          )}
          {!notif.leido && (
            <form action={marcarLeidoAction.bind(null, notif.id)}>
              <button
                type="submit"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Marcar leído
              </button>
            </form>
          )}
        </div>
      </div>
      {!notif.leido && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </div>
  )
}

export default async function NotificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'todas' } = await searchParams

  const rol = await getRolActual()
  if (rol === 'empleado') redirect('/')

  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const en7dias = new Date(Date.now() + 7 * 86_400_000)
    .toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

  const [
    { data: notifs },
    { count: stockBajo },
    { count: lotesAlerta },
  ] = await Promise.all([
    supabase
      .from('notificaciones')
      .select('id, tipo, titulo, mensaje, url, leido, leido_en, creado_por, created_at')
      .eq('negocio_id', negocio.id)
      .order('created_at', { ascending: false })
      .limit(100),

    supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .lte('existencias', STOCK_MINIMO)
      .gt('existencias', 0),

    supabase
      .from('lotes_producto')
      .select('*', { count: 'exact', head: true })
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .or(`fecha_caducidad.lte.${en7dias},estado_manual.eq.negro`),
  ])

  const todas = (notifs ?? []) as Notif[]
  const noLeidas = todas.filter((n) => !n.leido).length
  const mensajes = todas.filter((n) => n.tipo === 'mensaje_empleado')
  const sistema = todas.filter((n) => n.tipo !== 'mensaje_empleado')

  const tabs = [
    { key: 'todas',    label: 'Todas',    count: todas.length    },
    { key: 'mensajes', label: 'Mensajes', count: mensajes.length },
    { key: 'sistema',  label: 'Sistema',  count: sistema.length  },
  ]

  const visibles = tab === 'mensajes' ? mensajes : tab === 'sistema' ? sistema : todas

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Notificaciones</h1>
          {noLeidas > 0 && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {noLeidas} sin leer
            </p>
          )}
        </div>
        {noLeidas > 0 && (
          <form action={marcarTodasLeidasAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar todo leído
            </button>
          </form>
        )}
      </div>

      {/* Alertas en curso (estado del sistema, no almacenadas) */}
      {((stockBajo ?? 0) > 0 || (lotesAlerta ?? 0) > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Alertas en curso
          </p>
          {(stockBajo ?? 0) > 0 && (
            <Link
              href="/productos?alerta=bajo"
              className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800/40 px-4 py-3 text-sm font-medium text-orange-700 dark:text-orange-400 hover:opacity-90 transition-opacity"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500" />
              <span>
                <strong>{stockBajo}</strong> {stockBajo === 1 ? 'producto tiene' : 'productos tienen'} stock bajo
              </span>
              <span className="ml-auto text-orange-500">Ver →</span>
            </Link>
          )}
          {(lotesAlerta ?? 0) > 0 && (
            <Link
              href="/caducidad?estado=negro"
              className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800/40 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400 hover:opacity-90 transition-opacity"
            >
              <CalendarX className="h-4 w-4 shrink-0 text-red-500" />
              <span>
                <strong>{lotesAlerta}</strong> {lotesAlerta === 1 ? 'lote caduca' : 'lotes caducan'} en 7 días o ya vencido
              </span>
              <span className="ml-auto text-red-500">Ver →</span>
            </Link>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(({ key, label, count }) => (
          <Link
            key={key}
            href={`/notificaciones?tab=${key}`}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn(
                'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                tab === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>
                {count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Lista de eventos */}
      {visibles.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Bell className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>Sin notificaciones aquí.</p>
        </div>
      ) : (
        <div className="card-soft divide-y overflow-hidden">
          {visibles.map((n) => (
            <NotifRow key={n.id} notif={n} />
          ))}
        </div>
      )}
    </div>
  )
}
