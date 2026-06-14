export const TZ = 'America/Mexico_City'

// Current date in Mexico timezone as "YYYY-MM-DD"
export function hoyMX(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

// Add N calendar days to a Mexico date string (YYYY-MM-DD)
export function addDaysMX(fechaMX: string, days: number): string {
  const d = new Date(fechaMX + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}

// Convert a Mexico calendar date to UTC start/end ISO strings.
// Uses a noon-UTC probe to detect the active offset (CST -6 or CDT -5).
export function mexicoDayRange(fechaMX: string): { start: string; end: string } {
  const probe = new Date(fechaMX + 'T12:00:00Z')
  const mexHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(probe),
    10,
  )
  const start = new Date(probe)
  start.setUTCHours(12 - mexHour, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  end.setUTCMilliseconds(-1)
  return { start: start.toISOString(), end: end.toISOString() }
}

// --- Formatters (all force America/Mexico_City timezone) ---

export function fmtFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtFechaHoraCorta(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function fmtVentaLabel(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
