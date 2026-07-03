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
  const { data: productos } = await supabase
    .from('productos')
    .select('nombre, precio_venta, precio_costo, existencias, activo, categorias_producto(nombre)')
    .eq('negocio_id', negocio.id)
    .order('nombre')

  const rows = (productos ?? []).map((p) => {
    const pv = p.precio_venta / 100
    const pc = (p.precio_costo ?? 0) / 100
    const margen = pc > 0 ? Math.round(((pv - pc) / pv) * 100) : ''
    return {
      Nombre: p.nombre,
      Categoría: (p.categorias_producto as unknown as { nombre: string } | null)?.nombre ?? '',
      'Precio venta': pv,
      'Precio costo': pc || '',
      'Margen %': margen,
      Stock: p.existencias,
      Activo: p.activo ? 'Sí' : 'No',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Productos')
  ws['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 8 }]

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `productos-${negocio.nombre.replace(/\s+/g, '-')}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
