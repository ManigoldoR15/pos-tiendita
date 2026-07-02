import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getModulos } from '@/lib/modulos'

export async function GET() {
  const negocio = await getNegocioActual()
  if (!negocio) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const modulos = await getModulos()
  if (!modulos.exportacion) return NextResponse.json({ error: 'Módulo no habilitado' }, { status: 403 })

  const supabase = await createClient()
  const { data: gastos } = await supabase
    .from('gastos')
    .select('monto, descripcion, fecha, es_personal, categorias_gasto(nombre)')
    .eq('negocio_id', negocio.id)
    .order('fecha', { ascending: false })
    .limit(1000)

  const rows = (gastos ?? []).map((g) => ({
    Fecha: g.fecha,
    Categoría: (g.categorias_gasto as unknown as { nombre: string } | null)?.nombre ?? '',
    Descripción: g.descripcion ?? '',
    Tipo: g.es_personal ? 'Personal' : 'Negocio',
    Monto: g.monto / 100,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Gastos')
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 10 }, { wch: 12 }]

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `gastos-${negocio.nombre.replace(/\s+/g, '-')}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
