'use client'

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { formatMXN } from '@/lib/dinero'

export type DonutSlice  = { nombre: string; monto: number }
export type MesBar      = { mes: string; ingresos: number; egresos: number }
export type DiaSemana   = { dia: string; total: number; tickets: number }

const COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'oklch(0.70 0.10 220)',
  'oklch(0.65 0.12 280)',
  'oklch(0.60 0.14 30)',
  'oklch(0.72 0.11 170)',
]

function MXNTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold">{payload[0].name}</p>
      <p className="text-primary">{formatMXN(Math.round(payload[0].value * 100))}</p>
    </div>
  )
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }}>
          {p.name}: {formatMXN(Math.round(p.value * 100))}
        </p>
      ))}
    </div>
  )
}

function DiaTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold">{label}</p>
      <p className="text-primary">{formatMXN(Math.round(payload[0].value * 100))}</p>
    </div>
  )
}

export function DonutEgresos({ data }: { data: DonutSlice[] }) {
  if (!data.length) return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Sin egresos este mes</div>
  )
  const chartData = data.map((d) => ({ name: d.nombre, value: d.monto / 100 }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip content={<MXNTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function BarrasSeisM({ data }: { data: MesBar[] }) {
  const chartData = data.map((d) => ({ mes: d.mes, Ingresos: d.ingresos / 100, Egresos: d.egresos / 100 }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={42} />
        <Tooltip content={<BarTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Ingresos" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Egresos"  fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DiasSemanaChart({ data }: { data: DiaSemana[] }) {
  const chartData = data.map((d) => ({ dia: d.dia, Ventas: d.total / 100 }))
  const maxVal = Math.max(...chartData.map((d) => d.Ventas))
  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={chartData} barCategoryGap="25%">
        <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis hide domain={[0, maxVal * 1.2]} />
        <Tooltip content={<DiaTooltip />} />
        <Bar dataKey="Ventas" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
