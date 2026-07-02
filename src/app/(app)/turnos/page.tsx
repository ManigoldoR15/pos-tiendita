export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { requireModulo } from '@/lib/modulos'
import { hoyMX, mexicoDayRange, TZ } from '@/lib/fecha'

function emailLabel(email: string | null) {
  return email ? email.split('@')[0] : '—'
}

type MiembroRow = { user_id: string; email: string; rol: string }
type RegistroRow = { id: string; user_id: string; nombre: string; entrada_at: string; salida_at: string | null }

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  await requireModulo('turnos')

  const supabase = await createClient()

  const hoy = hoyMX()
  const { start: inicioHoy, end: finHoy } = mexicoDayRange(hoy)

  // Filtros del historial (default: hoy)
  const empId  = params.emp  ?? null
  const desde  = params.desde ?? hoy
  const hasta  = params.hasta ?? hoy

  const desdeRange = mexicoDayRange(desde)
  const hastaRange = mexicoDayRange(hasta)

  // Query base registros_turno filtrados
  let registrosQuery = supabase
    .from('registros_turno')
    .select('id, user_id, nombre, entrada_at, salida_at')
    .eq('negocio_id', negocio.id)
    .gte('entrada_at', desdeRange.start)
    .lte('entrada_at', hastaRange.end)
    .order('entrada_at', { ascending: false })
  if (empId) registrosQuery = registrosQuery.eq('user_id', empId)

  const [
    { data: miembros },
    { data: cajasAbiertas },
    { data: turnosActivosHoy },
    { data: registrosFiltrados },
  ] = await Promise.all([
    supabase.rpc('get_miembros_negocio', { p_negocio_id: negocio.id }),
    supabase
      .from('cortes_caja')
      .select('id, abierto_por, fecha_apertura')
      .eq('negocio_id', negocio.id)
      .eq('estado', 'abierto')
      .order('fecha_apertura', { ascending: true }),
    supabase
      .from('registros_turno')
      .select('id, user_id, nombre, entrada_at, salida_at')
      .eq('negocio_id', negocio.id)
      .is('salida_at', null)
      .gte('entrada_at', inicioHoy)
      .lte('entrada_at', finHoy)
      .order('entrada_at', { ascending: true }),
    registrosQuery,
  ])

  const miembrosMap = new Map(
    ((miembros ?? []) as MiembroRow[]).map((m) => [m.user_id, m.email])
  )
  const empleados = ((miembros ?? []) as MiembroRow[]).filter((m) => m.rol !== 'dueno')

  // En línea ahora (cajas abiertas + registros activos, sin duplicados)
  type PersonaActiva = { user_id: string; label: string; desde: string }
  const activoMap = new Map<string, PersonaActiva>()
  for (const caja of cajasAbiertas ?? []) {
    const email = miembrosMap.get(caja.abierto_por) ?? caja.abierto_por.slice(0, 8)
    activoMap.set(caja.abierto_por, {
      user_id: caja.abierto_por,
      label: emailLabel(email),
      desde: caja.fecha_apertura,
    })
  }
  for (const t of turnosActivosHoy ?? []) {
    if (!activoMap.has(t.user_id)) {
      activoMap.set(t.user_id, {
        user_id: t.user_id,
        label: emailLabel(miembrosMap.get(t.user_id) ?? t.nombre),
        desde: t.entrada_at,
      })
    }
  }
  const personasActivas = [...activoMap.values()]
  const registros = (registrosFiltrados ?? []) as RegistroRow[]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight">Turnos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quién está trabajando y el historial de entradas y salidas
        </p>
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
              return (
                <div key={p.user_id} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {p.label.substring(0, 2).toUpperCase()}
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

      {/* Historial de turnos */}
      <div className="card-soft overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Historial de turnos</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Entradas y salidas registradas por todos los empleados
          </p>
        </div>

        {/* Filtros */}
        <form method="get" className="flex flex-wrap gap-3 items-end border-b px-5 py-4 bg-muted/20">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Empleado</label>
            <select
              name="emp"
              defaultValue={empId ?? ''}
              className="h-9 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">Todos</option>
              {empleados.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {emailLabel(m.email)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Desde</label>
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              className="h-9 rounded-lg border bg-background px-3 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Hasta</label>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              className="h-9 rounded-lg border bg-background px-3 text-sm"
            />
          </div>

          <button
            type="submit"
            className="h-9 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Buscar
          </button>
        </form>

        {/* Resultados */}
        {registros.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            <p className="font-medium">Sin registros para este período</p>
            <p className="mt-1 text-xs">Ajusta las fechas o el empleado y vuelve a buscar.</p>
          </div>
        ) : (
          <div className="divide-y">
            {registros.map((r) => {
              const label = emailLabel(miembrosMap.get(r.user_id) ?? r.nombre)
              const fechaDia = new Date(r.entrada_at).toLocaleDateString('es-MX', {
                timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short',
              })
              const horaEntrada = new Date(r.entrada_at).toLocaleTimeString('es-MX', {
                timeZone: TZ, hour: '2-digit', minute: '2-digit',
              })
              const horaSalida = r.salida_at
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
                    {label.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{fechaDia}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>Entrada: {horaEntrada}</p>
                    {horaSalida
                      ? <p>Salida: {horaSalida}</p>
                      : <p className="text-emerald-600 font-medium">En turno</p>}
                  </div>
                  <div className="shrink-0 w-16 text-right">
                    {horaSalida ? (
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

        {/* Footer con count */}
        {registros.length > 0 && (
          <div className="border-t px-5 py-3 text-xs text-muted-foreground">
            {registros.length} registro{registros.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
