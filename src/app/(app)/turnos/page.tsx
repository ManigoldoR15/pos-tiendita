export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { fmtFechaCorta, fmtFechaHoraCorta, hoyMX, mexicoDayRange, TZ } from '@/lib/fecha'
import { formatMXN } from '@/lib/dinero'
import CalendarioTurnos from './calendario-client'

function emailCajero(email: string | null) {
  return email ? email.split('@')[0] : '—'
}

type Vista = 'lista' | 'calendario'

type TurnoRow = {
  id: string
  fecha_apertura: string
  fecha_cierre: string
  monto_esperado: number | null
  monto_contado: number | null
  diferencia: number | null
  notas: string | null
  abierto_por: string
  apertura_email: string
  apertura_rol: string
  cerrado_por: string | null
  cierre_email: string | null
  cierre_rol: string | null
  duracion_min: number
  total_ventas: number
  num_ventas: number
  ventas_efectivo: number
  ventas_otros: number
}

type MiembroRow = {
  user_id: string
  email: string
  rol: string
}

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()

  // Filters from URL
  const vista: Vista = params.vista === 'calendario' ? 'calendario' : 'lista'
  const cajeroId = params.cajero ?? null
  const desde = params.desde ?? null
  const hasta = params.hasta ?? null

  const hoy = hoyMX()
  const { start: inicioHoy, end: finHoy } = mexicoDayRange(hoy)

  const [
    { data: turnos },
    { data: miembros },
    { data: cajasAbiertas },
    { data: turnosActivosHoy },
    { data: todosLosRegistrosHoy },
  ] = await Promise.all([
    // Turnos de caja cerrados (con filtros)
    supabase.rpc('get_turnos_negocio', {
      p_negocio_id: negocio.id,
      p_cajero_id: cajeroId,
      p_desde: desde,
      p_hasta: hasta,
    }),
    // Lista de miembros para nombres
    supabase.rpc('get_miembros_negocio', { p_negocio_id: negocio.id }),
    // Cajas abiertas ahora mismo
    supabase
      .from('cortes_caja')
      .select('id, abierto_por, fecha_apertura')
      .eq('negocio_id', negocio.id)
      .eq('estado', 'abierto')
      .order('fecha_apertura', { ascending: true }),
    // Registros de turno activos hoy (sin salida)
    supabase
      .from('registros_turno')
      .select('id, user_id, nombre, entrada_at, salida_at')
      .eq('negocio_id', negocio.id)
      .is('salida_at', null)
      .gte('entrada_at', inicioHoy)
      .lte('entrada_at', finHoy)
      .order('entrada_at', { ascending: true }),
    // TODOS los registros de turno de hoy (activos + cerrados)
    supabase
      .from('registros_turno')
      .select('id, user_id, nombre, entrada_at, salida_at')
      .eq('negocio_id', negocio.id)
      .gte('entrada_at', inicioHoy)
      .lte('entrada_at', finHoy)
      .order('entrada_at', { ascending: true }),
  ])

  const miembrosMap = new Map(
    ((miembros ?? []) as MiembroRow[]).map((m) => [m.user_id, m.email])
  )

  // ── En línea ahora (cajas abiertas + registros activos, sin duplicados) ──
  type PersonaActiva = { user_id: string; label: string; desde: string }
  const activoMap = new Map<string, PersonaActiva>()
  for (const caja of cajasAbiertas ?? []) {
    const email = miembrosMap.get(caja.abierto_por) ?? caja.abierto_por.slice(0, 8)
    activoMap.set(caja.abierto_por, {
      user_id: caja.abierto_por,
      label: emailCajero(email),
      desde: caja.fecha_apertura,
    })
  }
  for (const t of turnosActivosHoy ?? []) {
    if (!activoMap.has(t.user_id)) {
      const email = miembrosMap.get(t.user_id) ?? t.nombre
      activoMap.set(t.user_id, {
        user_id: t.user_id,
        label: emailCajero(email),
        desde: t.entrada_at,
      })
    }
  }
  const personasActivas = [...activoMap.values()]

  // ── Historial de hoy (todos los registros_turno de hoy) ──────────────────
  type RegistroHoy = { id: string; user_id: string; nombre: string; entrada_at: string; salida_at: string | null }
  const registrosHoy = (todosLosRegistrosHoy ?? []) as RegistroHoy[]

  const lista = (turnos ?? []) as TurnoRow[]
  const cajeros = (miembros ?? []).filter((m: MiembroRow) => m.rol !== 'dueno') as MiembroRow[]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Turnos de caja</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Historial de turnos cerrados por cajero · solo visible para el dueño
          </p>
        </div>
      </div>

      {/* En línea ahora */}
      <div className="card-soft p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-semibold">En línea ahora</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            {personasActivas.length}
          </span>
        </div>
        {personasActivas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nadie en turno en este momento.</p>
        ) : (
          <div className="space-y-2">
            {personasActivas.map((p) => {
              const hora = new Date(p.desde).toLocaleTimeString('es-MX', {
                timeZone: TZ, hour: '2-digit', minute: '2-digit',
              })
              const initials = p.label.substring(0, 2).toUpperCase()
              return (
                <div key={p.user_id} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {initials}
                  </div>
                  <p className="flex-1 text-sm font-medium">{p.label}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    desde {hora}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Historial de hoy */}
      <div className="card-soft overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <span className="text-sm font-semibold">Historial de hoy</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {registrosHoy.length}
          </span>
        </div>
        {registrosHoy.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Ningún empleado ha registrado entrada hoy todavía.
          </p>
        ) : (
          <div className="divide-y">
            {registrosHoy.map((r) => {
              const label = emailCajero(miembrosMap.get(r.user_id) ?? r.nombre)
              const initials = label.substring(0, 2).toUpperCase()
              const entrada = new Date(r.entrada_at).toLocaleTimeString('es-MX', {
                timeZone: TZ, hour: '2-digit', minute: '2-digit',
              })
              const salida = r.salida_at
                ? new Date(r.salida_at).toLocaleTimeString('es-MX', {
                    timeZone: TZ, hour: '2-digit', minute: '2-digit',
                  })
                : null
              const ms = (r.salida_at ? new Date(r.salida_at) : new Date()).getTime()
                - new Date(r.entrada_at).getTime()
              const durH = Math.floor(ms / 3_600_000)
              const durM = Math.floor((ms % 3_600_000) / 60_000)
              const durLabel = durH > 0 ? `${durH}h ${durM}m` : `${durM}m`
              return (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      Entrada: {entrada}
                      {salida ? ` · Salida: ${salida}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {salida ? (
                      <span className="text-xs text-muted-foreground">{durLabel}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {durLabel}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Turnos de caja cerrados — filtros + tabla */}
      <div>
        <h2 className="mb-3 text-base font-bold">Cortes de caja cerrados</h2>

      {/* Filters + view toggle */}
      <form method="get" className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Cajero</label>
          <select
            name="cajero"
            defaultValue={cajeroId ?? ''}
            className="h-9 rounded-lg border bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            {cajeros.map((m: { user_id: string; email: string }) => (
              <option key={m.user_id} value={m.user_id}>
                {emailCajero(m.email)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Desde</label>
          <input
            type="date"
            name="desde"
            defaultValue={desde ?? ''}
            className="h-9 rounded-lg border bg-background px-3 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Hasta</label>
          <input
            type="date"
            name="hasta"
            defaultValue={hasta ?? ''}
            className="h-9 rounded-lg border bg-background px-3 text-sm"
          />
        </div>

        <input type="hidden" name="vista" value={vista} />

        <button
          type="submit"
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Filtrar
        </button>

        {(cajeroId || desde || hasta) && (
          <Link
            href={`/turnos?vista=${vista}`}
            className="h-9 flex items-center rounded-lg border px-4 text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            Limpiar
          </Link>
        )}

        {/* View toggle */}
        <div className="ml-auto flex rounded-lg border overflow-hidden text-sm">
          <Link
            href={`/turnos?${new URLSearchParams({ ...(cajeroId ? { cajero: cajeroId } : {}), ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}), vista: 'lista' }).toString()}`}
            className={[
              'px-3 py-2 font-medium transition-colors',
              vista === 'lista' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            Lista
          </Link>
          <Link
            href={`/turnos?${new URLSearchParams({ ...(cajeroId ? { cajero: cajeroId } : {}), ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}), vista: 'calendario' }).toString()}`}
            className={[
              'px-3 py-2 font-medium transition-colors',
              vista === 'calendario' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            Calendario
          </Link>
        </div>
      </form>

      {lista.length === 0 ? (
        <div className="card-soft p-10 text-center text-muted-foreground">
          <p className="font-medium">No hay turnos cerrados</p>
          <p className="text-sm mt-1">
            Los turnos aparecen aquí cuando el cajero cierra la caja desde /corte.
          </p>
        </div>
      ) : vista === 'calendario' ? (
        <div className="card-soft p-5 max-w-sm">
          <CalendarioTurnos
            turnos={lista.map((t) => ({
              id: t.id as string,
              fecha_cierre: t.fecha_cierre as string,
              apertura_email: (t.apertura_email as string) ?? '',
              num_ventas: Number(t.num_ventas),
            }))}
          />
        </div>
      ) : (
        <div className="card-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Cierre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Abrió</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Cerró</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Ventas</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Diferencia</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((t) => {
                const dif = Number(t.diferencia ?? 0)
                const difColor = dif === 0 ? 'text-foreground' : dif > 0 ? 'text-blue-600' : 'text-red-600'
                return (
                  <tr key={t.id as string} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fmtFechaHoraCorta(t.fecha_cierre as string)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{emailCajero(t.apertura_email as string | null)}</span>
                      <span className="ml-1 text-xs text-muted-foreground">({t.apertura_rol})</span>
                    </td>
                    <td className="px-4 py-3">
                      {t.cerrado_por ? (
                        <>
                          <span className="font-medium">{emailCajero(t.cierre_email as string | null)}</span>
                          {(t.cerrado_por as string) !== (t.abierto_por as string) && (
                            <span className="ml-1 text-xs text-muted-foreground">({t.cierre_rol})</span>
                          )}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{Number(t.num_ventas)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatMXN(Number(t.total_ventas))}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-bold ${difColor}`}>
                      {dif === 0 ? '—' : `${dif > 0 ? '+' : ''}${formatMXN(dif)}`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/turnos/${t.id}`}
                        className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-accent transition-colors"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </div> {/* fin Cortes de caja cerrados */}
    </div>
  )
}
