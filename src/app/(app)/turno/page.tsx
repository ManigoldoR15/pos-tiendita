import { redirect } from 'next/navigation'
import { LogIn, LogOut, Clock, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { hoyMX, TZ } from '@/lib/fecha'
import { registrarEntrada, registrarSalida } from './actions'

function fmtHora(ts: string) {
  return new Date(ts).toLocaleTimeString('es-MX', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function duracion(desde: string, hasta?: string | null) {
  const ms = (hasta ? new Date(hasta) : new Date()).getTime() - new Date(desde).getTime()
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h === 0) return `${m} min`
  return `${h}h ${m}m`
}

export default async function TurnoPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hoy = hoyMX()
  const inicioHoy = `${hoy}T00:00:00`
  const finHoy    = `${hoy}T23:59:59`

  // Turno activo hoy (sin salida)
  const { data: turnoActivo } = await supabase
    .from('registros_turno')
    .select('id, entrada_at, salida_at, nombre')
    .eq('user_id', user.id)
    .eq('negocio_id', negocio.id)
    .is('salida_at', null)
    .gte('entrada_at', inicioHoy)
    .lte('entrada_at', finHoy)
    .order('entrada_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Historial de hoy (turnos cerrados)
  const { data: historial } = await supabase
    .from('registros_turno')
    .select('id, entrada_at, salida_at')
    .eq('user_id', user.id)
    .eq('negocio_id', negocio.id)
    .not('salida_at', 'is', null)
    .gte('entrada_at', inicioHoy)
    .lte('entrada_at', finHoy)
    .order('entrada_at', { ascending: false })

  const nombreDisplay = user.email?.split('@')[0]
    ?.split(/[._-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') ?? 'Empleado'

  return (
    <div className="mx-auto max-w-sm space-y-6 px-2 py-4">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-xl border bg-card text-muted-foreground transition hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-black tracking-tight">Mi turno</h1>
          <p className="text-xs text-muted-foreground">{negocio.nombre}</p>
        </div>
      </div>

      {/* Estado actual */}
      {turnoActivo ? (
        /* ── EN TURNO ── */
        <div className="card-soft space-y-5 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div>
            <p className="text-lg font-bold">{nombreDisplay}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Entraste a las{' '}
              <span className="font-semibold text-foreground">
                {fmtHora(turnoActivo.entrada_at)}
              </span>
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              En turno · {duracion(turnoActivo.entrada_at)}
            </div>
          </div>

          <form action={registrarSalida.bind(null, turnoActivo.id)}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-3 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Registrar salida
            </button>
          </form>
        </div>
      ) : (
        /* ── SIN TURNO ACTIVO ── */
        <div className="card-soft space-y-5 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <LogIn className="h-8 w-8 text-primary" />
          </div>

          <div>
            <p className="text-lg font-bold">{nombreDisplay}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {(historial ?? []).length > 0
                ? 'Turno finalizado. ¿Empezás otro?'
                : 'Registra tu entrada para comenzar el turno'}
            </p>
          </div>

          <form action={registrarEntrada}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              <LogIn className="h-4 w-4" />
              Registrar entrada
            </button>
          </form>
        </div>
      )}

      {/* Historial del día */}
      {(historial ?? []).length > 0 && (
        <div className="card-soft overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hoy
            </span>
          </div>
          <div className="divide-y">
            {(historial ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="tabular-nums text-muted-foreground">
                  {fmtHora(r.entrada_at)} → {r.salida_at ? fmtHora(r.salida_at) : '—'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.salida_at ? duracion(r.entrada_at, r.salida_at) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
