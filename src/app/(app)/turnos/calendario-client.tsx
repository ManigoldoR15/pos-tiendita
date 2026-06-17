'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TZ } from '@/lib/fecha'

type TurnoDia = {
  id: string
  fecha_cierre: string
  apertura_email: string
  num_ventas: number
}

type Props = {
  turnos: TurnoDia[]
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function toMXDate(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso))
}

function emailCajero(email: string) {
  return email.split('@')[0]
}

export default function CalendarioTurnos({ turnos }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-based
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  // Group turnos by MX date
  const byDay = new Map<string, TurnoDia[]>()
  for (const t of turnos) {
    const d = toMXDate(t.fecha_cierre)
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d)!.push(t)
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay() // 0=sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      return key
    }),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedTurnos = selectedDay ? (byDay.get(selectedDay) ?? []) : []

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="font-semibold text-sm">
          {MESES[month]} {year}
        </h3>
        <button
          onClick={nextMonth}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS.map(d => (
          <div key={d} className="text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}

        {/* Cells */}
        {cells.map((dateKey, idx) => {
          if (!dateKey) return <div key={`empty-${idx}`} />
          const dayNum = parseInt(dateKey.split('-')[2])
          const hasTurnos = byDay.has(dateKey)
          const count = byDay.get(dateKey)?.length ?? 0
          const isSelected = selectedDay === dateKey
          const todayKey = toMXDate(new Date().toISOString())
          const isToday = dateKey === todayKey

          return (
            <button
              key={dateKey}
              onClick={() => setSelectedDay(isSelected ? null : dateKey)}
              className={[
                'relative flex flex-col items-center justify-center rounded-lg py-2 px-1 text-sm transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : hasTurnos
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : isToday
                  ? 'ring-1 ring-primary text-foreground hover:bg-accent'
                  : 'text-muted-foreground hover:bg-accent',
              ].join(' ')}
            >
              <span className="font-medium leading-none">{dayNum}</span>
              {hasTurnos && !isSelected && (
                <span className="mt-0.5 text-[10px] font-bold leading-none">
                  {count > 1 ? `${count}` : '•'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {new Date(selectedDay + 'T12:00:00Z').toLocaleDateString('es-MX', {
              timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
          {selectedTurnos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin turnos este día.</p>
          ) : (
            <div className="space-y-1">
              {selectedTurnos.map(t => (
                <a
                  key={t.id}
                  href={`/turnos/${t.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <span className="font-medium">{emailCajero(t.apertura_email)}</span>
                  <span className="text-xs text-muted-foreground">{t.num_ventas} ventas →</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
