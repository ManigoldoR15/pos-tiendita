import { hoyMX, mexicoDayRange, addDaysMX } from './fecha'

export type Periodo = 'hoy' | 'semana' | 'mes' | 'rango'

export type Rango = {
  start: string    // ISO UTC para filtros de timestamptz
  end: string
  startDate: string  // YYYY-MM-DD en hora México, para filtros de date
  endDate: string
}

export function getRango(p: string, desde?: string, hasta?: string): Rango {
  const hoy = hoyMX()  // "YYYY-MM-DD" en hora de México

  if (p === 'semana') {
    const hace6d = addDaysMX(hoy, -6)
    const { start } = mexicoDayRange(hace6d)
    const { end }   = mexicoDayRange(hoy)
    return { start, end, startDate: hace6d, endDate: hoy }
  }

  if (p === 'mes') {
    const primerDia = hoy.substring(0, 8) + '01'
    const { start } = mexicoDayRange(primerDia)
    const { end }   = mexicoDayRange(hoy)
    return { start, end, startDate: primerDia, endDate: hoy }
  }

  if (p === 'rango' && desde && hasta) {
    const { start } = mexicoDayRange(desde)
    const { end }   = mexicoDayRange(hasta)
    return { start, end, startDate: desde, endDate: hasta }
  }

  // hoy (default)
  const { start, end } = mexicoDayRange(hoy)
  return { start, end, startDate: hoy, endDate: hoy }
}

export function getRangoPrevio(p: string, desde?: string, hasta?: string): Rango {
  const hoy = hoyMX()

  if (p === 'semana') {
    const hace13 = addDaysMX(hoy, -13)
    const hace7  = addDaysMX(hoy, -7)
    const { start } = mexicoDayRange(hace13)
    const { end }   = mexicoDayRange(hace7)
    return { start, end, startDate: hace13, endDate: hace7 }
  }

  if (p === 'mes') {
    const year  = parseInt(hoy.slice(0, 4))
    const month = parseInt(hoy.slice(5, 7))
    const py = month === 1 ? year - 1 : year
    const pm = month === 1 ? 12 : month - 1
    const primerDia = `${py}-${String(pm).padStart(2, '0')}-01`
    const ultimoDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })
      .format(new Date(Date.UTC(year, month - 1, 0)))
    const { start } = mexicoDayRange(primerDia)
    const { end }   = mexicoDayRange(ultimoDia)
    return { start, end, startDate: primerDia, endDate: ultimoDia }
  }

  if (p === 'rango' && desde && hasta) {
    const dias = Math.round(
      (new Date(hasta).getTime() - new Date(desde).getTime()) / 86_400_000,
    ) + 1
    const prevEnd   = addDaysMX(desde, -1)
    const prevStart = addDaysMX(prevEnd, -(dias - 1))
    const { start } = mexicoDayRange(prevStart)
    const { end }   = mexicoDayRange(prevEnd)
    return { start, end, startDate: prevStart, endDate: prevEnd }
  }

  // hoy → ayer
  const ayer = addDaysMX(hoy, -1)
  const { start, end } = mexicoDayRange(ayer)
  return { start, end, startDate: ayer, endDate: ayer }
}

export const PERIODOS: { label: string; value: Periodo }[] = [
  { label: 'Hoy',    value: 'hoy'    },
  { label: 'Semana', value: 'semana' },
  { label: 'Mes',    value: 'mes'    },
  { label: 'Rango',  value: 'rango'  },
]
