import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { mexicoDayRange } from '@/lib/fecha'
import * as XLSX from 'xlsx'

function mesRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const firstDay = `${ym}-01`
  const lastDate = new Date(Date.UTC(y, m, 0))
  const lastDay = `${ym}-${String(lastDate.getUTCDate()).padStart(2, '0')}`
  return {
    start: mexicoDayRange(firstDay).start,
    end: mexicoDayRange(lastDay).end,
    startDate: firstDay,
    endDate: lastDay,
  }
}

export async function GET(req: NextRequest) {
  const rol = await getRolActual()
  if (rol !== 'dueno') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const negocio = await getNegocioActual()
  if (!negocio) return NextResponse.json({ error: 'Sin negocio' }, { status: 400 })

  const mes = req.nextUrl.searchParams.get('mes') ?? ''
  const ym = /^\d{4}-\d{2}$/.test(mes) ? mes : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()).slice(0, 7)
  const rango = mesRange(ym)

  const supabase = await createClient()
  const [{ data: ventas }, { data: gastos }, { data: items }] = await Promise.all([
    supabase
      .from('ventas')
      .select('total, created_at, metodos_pago(nombre)')
      .eq('negocio_id', negocio.id)
      .eq('estado', 'completada')
      .gte('created_at', rango.start)
      .lte('created_at', rango.end)
      .order('created_at'),
    supabase
      .from('gastos')
      .select('monto, descripcion, fecha, es_personal, categorias_gasto(nombre)')
      .eq('negocio_id', negocio.id)
      .gte('fecha', rango.startDate)
      .lte('fecha', rango.endDate)
      .order('fecha'),
    supabase
      .from('venta_items')
      .select('cantidad, subtotal, producto_id, productos(nombre, precio_costo), ventas!inner(created_at, estado)')
      .eq('ventas.estado', 'completada')
      .gte('ventas.created_at', rango.start)
      .lte('ventas.created_at', rango.end),
  ])

  const wb = XLSX.utils.book_new()
  const fmt = (n: number) => (n / 100).toFixed(2)
  const mesLabel = new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  // Sheet 1: Resumen
  const ingresos = (ventas ?? []).reduce((s, v) => s + v.total, 0)
  const egresos = (gastos ?? []).filter((g) => !g.es_personal).reduce((s, g) => s + g.monto, 0)
  const retiros = (gastos ?? []).filter((g) => g.es_personal).reduce((s, g) => s + g.monto, 0)
  const resumen = [
    ['Estado Mensual', mesLabel],
    [],
    ['Ingresos totales', fmt(ingresos)],
    ['Egresos del negocio', fmt(egresos)],
    ['Balance', fmt(ingresos - egresos)],
    ['Retiros personales', fmt(retiros)],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen')

  // Sheet 2: Ingresos (ventas)
  const ventasRows = (ventas ?? []).map((v) => ({
    Fecha: new Date(v.created_at).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' }),
    'Monto MXN': fmt(v.total),
    'Método pago': (v.metodos_pago as unknown as { nombre: string } | null)?.nombre ?? '',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventasRows), 'Ingresos')

  // Sheet 3: Egresos
  const gastosRows = (gastos ?? []).map((g) => ({
    Fecha: g.fecha,
    Categoría: (g.categorias_gasto as unknown as { nombre: string } | null)?.nombre ?? '',
    Descripción: g.descripcion ?? '',
    'Monto MXN': fmt(g.monto),
    Tipo: g.es_personal ? 'Personal' : 'Negocio',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gastosRows), 'Egresos')

  // Sheet 4: Top productos por ganancia
  type PG = { nombre: string; unidades: number; ganancia: number }
  const pmap = new Map<string, PG>()
  for (const item of items ?? []) {
    const prod = item.productos as unknown as { nombre: string; precio_costo: number | null } | null
    const nombre = prod?.nombre ?? 'Eliminado'
    const pc = prod?.precio_costo ?? 0
    const pv = pc > 0 ? item.subtotal / item.cantidad : 0
    const e = pmap.get(item.producto_id) ?? { nombre, unidades: 0, ganancia: 0 }
    e.unidades += item.cantidad
    e.ganancia += (pv - pc) * item.cantidad
    pmap.set(item.producto_id, e)
  }
  const prodRows = [...pmap.values()]
    .sort((a, b) => b.ganancia - a.ganancia)
    .slice(0, 20)
    .map((p, i) => ({
      '#': i + 1,
      Producto: p.nombre,
      Unidades: p.unidades,
      'Ganancia MXN': fmt(p.ganancia),
    }))
  if (prodRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodRows), 'Ganancia productos')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="finanzas-${ym}.xlsx"`,
    },
  })
}
