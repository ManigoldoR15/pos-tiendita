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

export const PERIODOS: { label: string; value: Periodo }[] = [
  { label: 'Hoy',    value: 'hoy'    },
  { label: 'Semana', value: 'semana' },
  { label: 'Mes',    value: 'mes'    },
  { label: 'Rango',  value: 'rango'  },
]
