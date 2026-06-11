export type Periodo = 'hoy' | 'semana' | 'mes' | 'rango'

export type Rango = {
  start: string   // ISO para ventas (timestamptz)
  end: string
  startDate: string  // YYYY-MM-DD para gastos (date)
  endDate: string
}

export function getRango(p: string, desde?: string, hasta?: string): Rango {
  const ahora = new Date()

  if (p === 'semana') {
    const ini = new Date(ahora)
    ini.setDate(ahora.getDate() - 6)
    ini.setHours(0, 0, 0, 0)
    return {
      start: ini.toISOString(),
      end: ahora.toISOString(),
      startDate: ini.toISOString().split('T')[0],
      endDate: ahora.toISOString().split('T')[0],
    }
  }

  if (p === 'mes') {
    const ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    return {
      start: ini.toISOString(),
      end: ahora.toISOString(),
      startDate: ini.toISOString().split('T')[0],
      endDate: ahora.toISOString().split('T')[0],
    }
  }

  if (p === 'rango' && desde && hasta) {
    return {
      start: new Date(desde + 'T00:00:00').toISOString(),
      end: new Date(hasta + 'T23:59:59.999').toISOString(),
      startDate: desde,
      endDate: hasta,
    }
  }

  // hoy (default)
  const ini = new Date(ahora)
  ini.setHours(0, 0, 0, 0)
  return {
    start: ini.toISOString(),
    end: ahora.toISOString(),
    startDate: ini.toISOString().split('T')[0],
    endDate: ahora.toISOString().split('T')[0],
  }
}

export const PERIODOS: { label: string; value: Periodo }[] = [
  { label: 'Hoy', value: 'hoy' },
  { label: 'Semana', value: 'semana' },
  { label: 'Mes', value: 'mes' },
  { label: 'Rango', value: 'rango' },
]
