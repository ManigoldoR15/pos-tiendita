'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { formatMXN } from '@/lib/dinero'

export type DiaVenta = { fecha: string; total: number }

function labelDia(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00Z')
  return d.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'short',
  })
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-sm">
      <p className="font-medium capitalize">{label}</p>
      <p className="font-bold text-primary">{formatMXN(Math.round(payload[0].value * 100))}</p>
    </div>
  )
}

export function SalesChart({ data }: { data: DiaVenta[] }) {
  const chartData = data.map((d) => ({
    label: labelDia(d.fecha),
    total: d.total / 100,
  }))

  const hasData = data.some((d) => d.total > 0)

  return (
    <div className="h-44">
      {!hasData ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Sin ventas en los últimos 7 días
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-accent)' }} />
            <Bar dataKey="total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
