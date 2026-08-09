import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

/**
 * Respaldo completo del negocio en un solo archivo, para que el dueño lo guarde
 * en su teléfono o computadora. Si la base se cae o se corrompe, sus números no
 * se van con ella.
 *
 * A diferencia de las otras exportaciones, esta NO se cierra tras el módulo de
 * exportación: poder llevarse los propios datos no es una función de paga.
 * Solo el dueño lo descarga — un empleado no debe llevarse el negocio completo.
 *
 * Va con ids reales para que el respaldo sirva también para reconstruir las
 * relaciones (qué venta corresponde a qué detalle), no solo para leerlo.
 */
export async function GET() {
  const negocio = await getNegocioActual()
  if (!negocio) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const rol = await getRolActual()
  if (rol !== 'dueno') {
    return NextResponse.json({ error: 'Solo el dueño puede descargar el respaldo' }, { status: 403 })
  }

  const supabase = await createClient()
  const n = negocio.id

  const [
    { data: productos }, { data: lotes }, { data: ventas }, { data: items },
    { data: clientes }, { data: abonos }, { data: gastos }, { data: cortes },
    { data: plazas }, { data: proveedores },
  ] = await Promise.all([
    supabase.from('productos')
      .select('id, nombre, precio_venta, precio_costo, existencias, unidad_medida, codigo_barras, activo, categorias_producto(nombre)')
      .eq('negocio_id', n).order('nombre'),
    supabase.from('lotes_producto')
      .select('id, producto_id, cantidad, cantidad_actual, fecha_recepcion, fecha_caducidad, ubicacion, local_id, activo')
      .eq('negocio_id', n).order('fecha_recepcion'),
    supabase.from('ventas')
      .select('id, created_at, total, descuento, pago_recibido, cambio, estado, es_fiado, cliente_id, vendedor_id, local_id, corte_id, metodos_pago(nombre)')
      .eq('negocio_id', n).order('created_at'),
    supabase.from('venta_items')
      .select('id, venta_id, producto_id, cantidad, precio_unitario, subtotal, es_fiado, variante_texto, ventas!inner(negocio_id)')
      .eq('ventas.negocio_id', n),
    supabase.from('clientes')
      .select('id, nombre, telefono, notas, en_lista_negra, activo, created_at')
      .eq('negocio_id', n).order('nombre'),
    supabase.from('abonos')
      .select('id, cliente_id, venta_id, monto, fecha, notas')
      .eq('negocio_id', n).order('fecha'),
    supabase.from('gastos')
      .select('id, fecha, monto, descripcion, es_personal, local_id, categorias_gasto(nombre)')
      .eq('negocio_id', n).order('fecha'),
    supabase.from('cortes_caja')
      .select('id, fecha_apertura, fecha_cierre, monto_inicial, monto_esperado, monto_contado, diferencia, estado, local_id')
      .eq('negocio_id', n).order('fecha_apertura'),
    supabase.from('locales')
      .select('id, nombre, direccion, activo').eq('negocio_id', n).order('created_at'),
    supabase.from('proveedores')
      .select('id, nombre, telefono, email, activo').eq('negocio_id', n).order('nombre'),
  ])

  // El dinero se guarda en centavos; en el respaldo va en pesos para que sea
  // legible desde el teléfono sin tener que dividir nada.
  const mxn = (c: number | null | undefined) => (c ?? 0) / 100
  const nombreDePlaza = new Map((plazas ?? []).map((p) => [p.id, p.nombre]))
  const plaza = (id: string | null) => (id ? nombreDePlaza.get(id) ?? 'plaza eliminada' : 'General')

  const hojas: [string, Record<string, unknown>[]][] = [
    ['Productos', (productos ?? []).map((p) => ({
      id: p.id,
      Nombre: p.nombre,
      Categoría: (p.categorias_producto as unknown as { nombre: string } | null)?.nombre ?? '',
      'Precio venta': mxn(p.precio_venta),
      'Precio costo': mxn(p.precio_costo),
      Stock: p.existencias,
      Unidad: p.unidad_medida,
      'Código de barras': p.codigo_barras ?? '',
      Activo: p.activo ? 'Sí' : 'No',
    }))],
    ['Inventario', (lotes ?? []).map((l) => ({
      id: l.id,
      producto_id: l.producto_id,
      Recibido: l.fecha_recepcion,
      'Cantidad inicial': l.cantidad,
      'Cantidad actual': l.cantidad_actual,
      Caduca: l.fecha_caducidad ?? '',
      Ubicación: l.ubicacion,
      Plaza: plaza(l.local_id),
      Activo: l.activo ? 'Sí' : 'No',
    }))],
    ['Ventas', (ventas ?? []).map((v) => ({
      id: v.id,
      Fecha: v.created_at,
      Total: mxn(v.total),
      Descuento: mxn(v.descuento),
      Recibido: mxn(v.pago_recibido),
      Cambio: mxn(v.cambio),
      'Método de pago': (v.metodos_pago as unknown as { nombre: string } | null)?.nombre ?? '',
      Estado: v.estado,
      Fiada: v.es_fiado ? 'Sí' : 'No',
      cliente_id: v.cliente_id ?? '',
      vendedor_id: v.vendedor_id ?? '',
      Plaza: plaza(v.local_id),
      corte_id: v.corte_id ?? '',
    }))],
    ['Detalle de ventas', (items ?? []).map((i) => ({
      venta_id: i.venta_id,
      producto_id: i.producto_id,
      Variante: i.variante_texto ?? '',
      Cantidad: i.cantidad,
      'Precio unitario': mxn(i.precio_unitario),
      Subtotal: mxn(i.subtotal),
      Fiado: i.es_fiado ? 'Sí' : 'No',
    }))],
    ['Clientes', (clientes ?? []).map((c) => ({
      id: c.id,
      Nombre: c.nombre,
      Teléfono: c.telefono ?? '',
      Notas: c.notas ?? '',
      'Lista negra': c.en_lista_negra ? 'Sí' : 'No',
      Activo: c.activo ? 'Sí' : 'No',
    }))],
    ['Abonos', (abonos ?? []).map((a) => ({
      id: a.id,
      Fecha: a.fecha,
      cliente_id: a.cliente_id,
      venta_id: a.venta_id ?? '',
      Monto: mxn(a.monto),
      Notas: a.notas ?? '',
    }))],
    ['Gastos', (gastos ?? []).map((g) => ({
      id: g.id,
      Fecha: g.fecha,
      Categoría: (g.categorias_gasto as unknown as { nombre: string } | null)?.nombre ?? '',
      Monto: mxn(g.monto),
      Descripción: g.descripcion ?? '',
      Personal: g.es_personal ? 'Sí' : 'No',
      Plaza: plaza(g.local_id),
    }))],
    ['Cortes de caja', (cortes ?? []).map((c) => ({
      id: c.id,
      Apertura: c.fecha_apertura,
      Cierre: c.fecha_cierre ?? '',
      'Fondo inicial': mxn(c.monto_inicial),
      Esperado: mxn(c.monto_esperado),
      Contado: mxn(c.monto_contado),
      Diferencia: mxn(c.diferencia),
      Estado: c.estado,
      Plaza: plaza(c.local_id),
    }))],
    ['Plazas', (plazas ?? []).map((p) => ({
      id: p.id, Nombre: p.nombre, Dirección: p.direccion ?? '', Activa: p.activo ? 'Sí' : 'No',
    }))],
    ['Proveedores', (proveedores ?? []).map((p) => ({
      id: p.id, Nombre: p.nombre, Teléfono: p.telefono ?? '', Email: p.email ?? '',
      Activo: p.activo ? 'Sí' : 'No',
    }))],
  ]

  const wb = XLSX.utils.book_new()

  // Portada: qué es esto y qué trae, para quien lo abra dentro de un año
  const resumen = [
    { Dato: 'Negocio', Valor: negocio.nombre },
    { Dato: 'Respaldo generado', Valor: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) },
    { Dato: 'Montos', Valor: 'En pesos mexicanos' },
    ...hojas.map(([nombre, filas]) => ({ Dato: nombre, Valor: `${filas.length} registros` })),
  ]
  const wsResumen = XLSX.utils.json_to_sheet(resumen)
  wsResumen['!cols'] = [{ wch: 22 }, { wch: 34 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  for (const [nombre, filas] of hojas) {
    // Una hoja vacía sin encabezados confunde: se deja constancia de que no hay datos
    const ws = filas.length > 0
      ? XLSX.utils.json_to_sheet(filas)
      : XLSX.utils.json_to_sheet([{ 'Sin registros': '' }])
    XLSX.utils.book_append_sheet(wb, ws, nombre)
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const filename = `respaldo-${negocio.nombre.replace(/[^a-zA-Z0-9]+/g, '-')}-${hoy}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
