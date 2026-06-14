import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaHoraCorta } from '@/lib/fecha'

export async function GET() {
  const negocio = await getNegocioActual()
  if (!negocio) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = await createClient()
  const { data: ventas } = await supabase
    .from('ventas')
    .select('id, total, descuento, created_at, estado, metodos_pago(nombre), clientes(nombre)')
    .eq('negocio_id', negocio.id)
    .order('created_at', { ascending: false })
    .limit(1000)

  const rows = (ventas ?? []).map((v) => ({
    Fecha: fmtFechaHoraCorta(v.created_at),
    Estado: v.estado,
    'Método de pago': (v.metodos_pago as unknown as { nombre: string } | null)?.nombre ?? '',
    Cliente: (v.clientes as unknown as { nombre: string } | null)?.nombre ?? '',
    Descuento: v.descuento / 100,
    Total: v.total / 100,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas')

  // Column widths
  ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 12 }]

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `ventas-${negocio.nombre.replace(/\s+/g, '-')}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
