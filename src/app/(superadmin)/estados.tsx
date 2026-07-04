import { cn } from '@/lib/utils'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// Vocabulario ÚNICO de estados del panel superadmin (Fase 2).
//
// Un negocio tiene DOS estados independientes que antes se mezclaban:
//
//   CUENTA — estado de la suscripción (¿puede/debe usar la plataforma?):
//     prueba · activo · vencido · suspendido
//     Misma regla que el CASE de sa_lista_negocios en SQL.
//
//   ACTIVIDAD — operación real (¿cuándo fue su última venta?):
//     vendió hoy · ayer · X días sin vender · sin ventas
//
// Todo el panel debe usar estos componentes; nada de badges ad-hoc.
// ═══════════════════════════════════════════════════════════════════════════

export type EstadoCuenta = 'prueba' | 'activo' | 'vencido' | 'suspendido'

export const ESTADOS_CUENTA: Record<EstadoCuenta, { label: string; badge: string; descr: string }> = {
  activo: {
    label: 'Activo',
    badge: 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40',
    descr: 'suscripción vigente',
  },
  prueba: {
    label: 'Prueba',
    badge: 'bg-blue-900/40 text-blue-400 border border-blue-700/40',
    descr: 'plan gratuito de prueba',
  },
  vencido: {
    label: 'Vencido',
    badge: 'bg-amber-900/40 text-amber-400 border border-amber-700/40',
    descr: 'suscripción vencida',
  },
  suspendido: {
    label: 'Suspendido',
    badge: 'bg-red-900/40 text-red-400 border border-red-700/40',
    descr: 'acceso bloqueado por el superadmin',
  },
}

/** Fecha de hoy (YYYY-MM-DD) en México — misma zona que usa el SQL. */
function hoyMX(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
}

/** Misma regla que el CASE de sa_lista_negocios/get_todos_negocios. */
export function calcEstadoCuenta(n: {
  suspendido: boolean
  plan: string | null
  suscripcion_fin: string | null
}): EstadoCuenta {
  if (n.suspendido) return 'suspendido'
  if (!n.plan || n.plan === 'prueba') return 'prueba'
  if (!n.suscripcion_fin) return 'activo'
  return n.suscripcion_fin >= hoyMX() ? 'activo' : 'vencido'
}

export function EstadoCuentaBadge({ estado, className }: { estado: string; className?: string }) {
  const info = ESTADOS_CUENTA[estado as EstadoCuenta]
  return (
    <span
      title={info ? `Cuenta: ${info.descr}` : undefined}
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        info?.badge ?? 'bg-slate-800 text-slate-400 border border-slate-700',
        className,
      )}
    >
      {info?.label ?? estado}
    </span>
  )
}

// ── Actividad ────────────────────────────────────────────────────────────────

export function actividadLabel(dias: number): string {
  if (dias === 9999) return 'Sin ventas'
  if (dias === 0) return 'Vendió hoy'
  if (dias === 1) return 'Ayer'
  return `${dias}d sin vender`
}

function actividadColor(dias: number): string {
  if (dias <= 7) return 'text-emerald-400'
  if (dias <= 30) return 'text-yellow-400'
  if (dias <= 90) return 'text-orange-400'
  return 'text-red-400'
}

/** Actividad pura (última venta) — la suspensión NO se muestra aquí: es estado de cuenta. */
export function ActividadBadge({ activoHoy, diasSinVenta }: { activoHoy: boolean; diasSinVenta: number }) {
  if (activoHoy) {
    return (
      <span
        title="Actividad: registró ventas hoy"
        className="inline-flex items-center gap-1 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-400"
      >
        <CheckCircle className="h-3 w-3" /> Hoy
      </span>
    )
  }
  return (
    <span
      title={`Actividad: ${actividadLabel(diasSinVenta).toLowerCase()}`}
      className={cn('text-xs font-semibold tabular-nums whitespace-nowrap', actividadColor(diasSinVenta))}
    >
      {diasSinVenta === 9999 ? 'Sin ventas' : diasSinVenta === 0 ? 'Hoy' : diasSinVenta === 1 ? 'Ayer' : `${diasSinVenta}d`}
      {diasSinVenta > 30 && diasSinVenta < 9999 && (
        <AlertCircle className="inline h-3 w-3 ml-0.5 mb-0.5" />
      )}
    </span>
  )
}

/** Leyenda del vocabulario, para mostrar junto a tablas con ambas columnas. */
export function LeyendaEstados() {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
      <Info className="h-3 w-3 shrink-0" />
      <span>
        <strong className="text-slate-400">Cuenta</strong> = estado de la suscripción (prueba, activo, vencido, suspendido) ·{' '}
        <strong className="text-slate-400">Actividad</strong> = última venta registrada
      </span>
    </p>
  )
}
