import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

/** Sube cuando cambie la forma del JSON, para que un restaurador futuro sepa
 *  qué está leyendo. */
const VERSION_RESPALDO = 1

/**
 * Respaldo completo del negocio, para que el dueño lo guarde en su teléfono o
 * computadora. Si la base se cae o se corrompe, sus números no se van con ella.
 *
 * Dos formatos, con propósitos distintos:
 *   - .xlsx (default): para leerlo. Fechas en hora de México, montos en pesos,
 *     nombres en vez de uuid. Lo abre un tendero desde el celular.
 *   - ?formato=json: para restaurar. Filas crudas tal cual están en la base
 *     (montos en centavos, todos los campos, ids y nulos). Ilegible a
 *     propósito: su valor es la fidelidad, no la presentación.
 *
 * A diferencia de las otras exportaciones, esta NO se cierra tras el módulo de
 * exportación: poder llevarse los propios datos no es una función de paga.
 * Solo el dueño lo descarga — un empleado no debe llevarse el negocio completo.
 */
export async function GET(request: Request) {
  const negocio = await getNegocioActual()
  if (!negocio) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const rol = await getRolActual()
  if (rol !== 'dueno') {
    return NextResponse.json({ error: 'Solo el dueño puede descargar el respaldo' }, { status: 403 })
  }

  const supabase = await createClient()
  const n = negocio.id
  const hoyMx = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const archivo = (ext: string) =>
    `respaldo-${negocio.nombre.replace(/[^a-zA-Z0-9]+/g, '-')}-${hoyMx}.${ext}`

  // ── Formato técnico: filas crudas, sin maquillar ────────────────────────
  if (new URL(request.url).searchParams.get('formato') === 'json') {
    const tabla = async (nombre: string) =>
      (await supabase.from(nombre).select('*').eq('negocio_id', n)).data ?? []

    const [
      productosRaw, variantes, lotesRaw, ventasRaw, clientesRaw, abonosRaw,
      gastosRaw, cortesRaw, localesRaw, proveedoresRaw, categoriasProd,
      categoriasGasto, metodosPago, compras, comprasItems, transferencias,
    ] = await Promise.all([
      tabla('productos'), tabla('variantes_producto'), tabla('lotes_producto'),
      tabla('ventas'), tabla('clientes'), tabla('abonos'), tabla('gastos'),
      tabla('cortes_caja'), tabla('locales'), tabla('proveedores'),
      tabla('categorias_producto'), tabla('categorias_gasto'), tabla('metodos_pago'),
      tabla('compras'), tabla('compras_items'), tabla('transferencias_inventario'),
    ])

    // venta_items no lleva negocio_id: se acota por las ventas del negocio
    const { data: itemsRaw } = await supabase
      .from('venta_items').select('*, ventas!inner(negocio_id)').eq('ventas.negocio_id', n)
    const venta_items = (itemsRaw ?? []).map((i) => {
      const { ventas: _descartar, ...fila } = i as Record<string, unknown>
      return fila
    })

    const respaldo = {
      _meta: {
        version: VERSION_RESPALDO,
        generado: new Date().toISOString(),
        negocio: { id: negocio.id, nombre: negocio.nombre },
        moneda: 'MXN',
        nota:
          'Montos en centavos enteros, tal como los guarda la base. Fechas en UTC (ISO 8601). ' +
          'Este archivo es para restaurar el sistema, no para leerlo: usa el .xlsx para consultarlo.',
      },
      productos: productosRaw,
      variantes_producto: variantes,
      lotes_producto: lotesRaw,
      ventas: ventasRaw,
      venta_items,
      clientes: clientesRaw,
      abonos: abonosRaw,
      gastos: gastosRaw,
      cortes_caja: cortesRaw,
      locales: localesRaw,
      proveedores: proveedoresRaw,
      categorias_producto: categoriasProd,
      categorias_gasto: categoriasGasto,
      metodos_pago: metodosPago,
      compras,
      compras_items: comprasItems,
      transferencias_inventario: transferencias,
    }

    return new NextResponse(JSON.stringify(respaldo, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${archivo('json')}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

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

  const TZ = 'America/Mexico_City'
  /** Timestamps: en hora de México, no en UTC. Una venta de las 8 pm del 8 de
   *  agosto aparecía fechada el 9 porque el crudo viene en UTC. */
  const fechaHora = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleString('es-MX', {
          timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : ''
  /** Columnas DATE ('2026-08-09'): se reordenan a mano; convertirlas con Date()
   *  las correría un día por la zona horaria. */
  const soloFecha = (f: string | null | undefined) => {
    if (!f) return ''
    const [a, m, d] = f.split('-')
    return d ? `${d}/${m}/${a}` : f
  }

  const nombreDePlaza = new Map((plazas ?? []).map((p) => [p.id, p.nombre]))
  const plaza = (id: string | null) => (id ? nombreDePlaza.get(id) ?? 'plaza eliminada' : 'General')
  const nombreDeCliente = new Map((clientes ?? []).map((c) => [c.id, c.nombre]))

  // Los uuid de vendedor no le dicen nada a nadie: se cambian por su nombre
  const { data: miembros } = await supabase.rpc('get_miembros_basico', { p_negocio_id: n })
  const nombreDeUsuario = new Map(
    ((miembros as { user_id: string; email: string }[] | null) ?? [])
      .map((m) => [m.user_id, m.email.split('@')[0]]),
  )

  // Primero lo que una persona lee; los ids van al final de cada fila, ahí para
  // quien tenga que reconstruir relaciones pero sin estorbar la vista.
  const nombreDeProducto = new Map((productos ?? []).map((p) => [p.id, p.nombre]))

  const hojas: [string, Record<string, unknown>[]][] = [
    ['Productos', (productos ?? []).map((p) => ({
      Producto: p.nombre,
      Categoría: (p.categorias_producto as unknown as { nombre: string } | null)?.nombre ?? '',
      'Precio venta': mxn(p.precio_venta),
      'Precio costo': mxn(p.precio_costo),
      Stock: Number(p.existencias),
      Unidad: p.unidad_medida,
      'Código de barras': p.codigo_barras ?? '',
      Activo: p.activo ? 'Sí' : 'No',
      id: p.id,
    }))],
    ['Inventario', (lotes ?? []).map((l) => ({
      Producto: nombreDeProducto.get(l.producto_id) ?? 'producto eliminado',
      Recibido: soloFecha(l.fecha_recepcion),
      'Cantidad inicial': Number(l.cantidad),
      'Cantidad actual': Number(l.cantidad_actual),
      Caduca: soloFecha(l.fecha_caducidad),
      Ubicación: l.ubicacion,
      Plaza: plaza(l.local_id),
      Activo: l.activo ? 'Sí' : 'No',
      producto_id: l.producto_id,
      id: l.id,
    }))],
    ['Ventas', (ventas ?? []).map((v) => ({
      Fecha: fechaHora(v.created_at),
      Total: mxn(v.total),
      Descuento: mxn(v.descuento),
      Recibido: mxn(v.pago_recibido),
      Cambio: mxn(v.cambio),
      'Método de pago': (v.metodos_pago as unknown as { nombre: string } | null)?.nombre ?? '',
      Cliente: v.cliente_id ? nombreDeCliente.get(v.cliente_id) ?? 'cliente eliminado' : 'Público en general',
      Vendedor: v.vendedor_id ? nombreDeUsuario.get(v.vendedor_id) ?? 'usuario dado de baja' : '',
      Plaza: plaza(v.local_id),
      Estado: v.estado,
      Fiada: v.es_fiado ? 'Sí' : 'No',
      id: v.id,
      corte_id: v.corte_id ?? '',
    }))],
    ['Detalle de ventas', (items ?? []).map((i) => ({
      Producto: nombreDeProducto.get(i.producto_id) ?? 'producto eliminado',
      Variante: i.variante_texto ?? '',
      Cantidad: Number(i.cantidad),
      'Precio unitario': mxn(i.precio_unitario),
      Subtotal: mxn(i.subtotal),
      Fiado: i.es_fiado ? 'Sí' : 'No',
      venta_id: i.venta_id,
      producto_id: i.producto_id,
    }))],
    ['Clientes', (clientes ?? []).map((c) => ({
      Cliente: c.nombre,
      Teléfono: c.telefono ?? '',
      Notas: c.notas ?? '',
      'Lista negra': c.en_lista_negra ? 'Sí' : 'No',
      Activo: c.activo ? 'Sí' : 'No',
      Alta: fechaHora(c.created_at),
      id: c.id,
    }))],
    ['Abonos', (abonos ?? []).map((a) => ({
      Fecha: soloFecha(a.fecha),
      Cliente: nombreDeCliente.get(a.cliente_id) ?? 'cliente eliminado',
      Monto: mxn(a.monto),
      Notas: a.notas ?? '',
      cliente_id: a.cliente_id,
      venta_id: a.venta_id ?? '',
      id: a.id,
    }))],
    ['Gastos', (gastos ?? []).map((g) => ({
      Fecha: soloFecha(g.fecha),
      Categoría: (g.categorias_gasto as unknown as { nombre: string } | null)?.nombre ?? '',
      Monto: mxn(g.monto),
      Descripción: g.descripcion ?? '',
      Personal: g.es_personal ? 'Sí' : 'No',
      Plaza: plaza(g.local_id),
      id: g.id,
    }))],
    ['Cortes de caja', (cortes ?? []).map((c) => ({
      Apertura: fechaHora(c.fecha_apertura),
      Cierre: fechaHora(c.fecha_cierre),
      'Fondo inicial': mxn(c.monto_inicial),
      Esperado: mxn(c.monto_esperado),
      Contado: mxn(c.monto_contado),
      Diferencia: mxn(c.diferencia),
      Estado: c.estado,
      Plaza: plaza(c.local_id),
      id: c.id,
    }))],
    ['Plazas', (plazas ?? []).map((p) => ({
      Plaza: p.nombre, Dirección: p.direccion ?? '', Activa: p.activo ? 'Sí' : 'No', id: p.id,
    }))],
    ['Proveedores', (proveedores ?? []).map((p) => ({
      Proveedor: p.nombre, Teléfono: p.telefono ?? '', Email: p.email ?? '',
      Activo: p.activo ? 'Sí' : 'No', id: p.id,
    }))],
  ]

  /** Anchos según el contenido real: sin esto todo sale aplastado y hay que
   *  ajustar columna por columna antes de poder leer nada. */
  function anchosDe(filas: Record<string, unknown>[]) {
    if (filas.length === 0) return undefined
    return Object.keys(filas[0]).map((col) => {
      const muestra = filas.slice(0, 300)
      const largo = Math.max(
        col.length,
        ...muestra.map((f) => String(f[col] ?? '').length),
      )
      return { wch: Math.min(Math.max(largo + 2, 9), 40) }
    })
  }

  /** Formato de moneda en las columnas de dinero: $1,234.50 en vez de 1234.5 */
  const COLUMNAS_DINERO = new Set([
    'Precio venta', 'Precio costo', 'Total', 'Descuento', 'Recibido', 'Cambio',
    'Precio unitario', 'Subtotal', 'Monto', 'Fondo inicial', 'Esperado',
    'Contado', 'Diferencia',
  ])
  function formatoMoneda(ws: XLSX.WorkSheet, filas: Record<string, unknown>[]) {
    if (filas.length === 0 || !ws['!ref']) return
    const rango = XLSX.utils.decode_range(ws['!ref'])
    const cols = Object.keys(filas[0])
    cols.forEach((col, idx) => {
      if (!COLUMNAS_DINERO.has(col)) return
      for (let fila = 1; fila <= rango.e.r; fila++) {
        const celda = ws[XLSX.utils.encode_cell({ r: fila, c: idx })]
        if (celda && celda.t === 'n') celda.z = '$#,##0.00'
      }
    })
  }

  const wb = XLSX.utils.book_new()

  // Portada: qué es esto, qué trae y los totales del negocio, para quien lo
  // abra dentro de un año sin acordarse de nada.
  const ventasValidas = (ventas ?? []).filter((v) => v.estado === 'completada')
  const totalVendido = ventasValidas.reduce((s, v) => s + (v.total ?? 0), 0)
  const totalGastos = (gastos ?? []).reduce((s, g) => s + (g.monto ?? 0), 0)
  const fechas = ventasValidas.map((v) => v.created_at).sort()

  const resumen = [
    { Dato: 'Negocio', Valor: negocio.nombre },
    { Dato: 'Respaldo generado', Valor: fechaHora(new Date().toISOString()) },
    { Dato: 'Historial desde', Valor: fechas.length ? fechaHora(fechas[0]) : 'sin ventas' },
    { Dato: 'Historial hasta', Valor: fechas.length ? fechaHora(fechas[fechas.length - 1]) : '—' },
    { Dato: 'Ventas completadas', Valor: ventasValidas.length },
    { Dato: 'Total vendido', Valor: `$${mxn(totalVendido).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` },
    { Dato: 'Total en gastos', Valor: `$${mxn(totalGastos).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` },
    { Dato: '', Valor: '' },
    { Dato: 'CONTENIDO', Valor: '' },
    ...hojas.map(([nombre, filas]) => ({ Dato: nombre, Valor: `${filas.length} registros` })),
    { Dato: '', Valor: '' },
    { Dato: 'Nota', Valor: 'Montos en pesos mexicanos. Fechas en hora de México.' },
    { Dato: '', Valor: 'Las columnas "id" al final de cada hoja sirven para reconstruir el sistema; puedes ignorarlas.' },
  ]
  const wsResumen = XLSX.utils.json_to_sheet(resumen)
  wsResumen['!cols'] = [{ wch: 22 }, { wch: 62 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  for (const [nombre, filas] of hojas) {
    // Una hoja vacía sin encabezados confunde: se deja constancia de que no hay datos
    const ws = filas.length > 0
      ? XLSX.utils.json_to_sheet(filas)
      : XLSX.utils.json_to_sheet([{ 'Sin registros': '' }])

    const cols = anchosDe(filas)
    if (cols) ws['!cols'] = cols
    formatoMoneda(ws, filas)
    // Fijar la fila de encabezados: al bajar 400 ventas se sigue viendo qué es cada columna
    if (filas.length > 0) ws['!freeze'] = { xSplit: 0, ySplit: 1 }

    XLSX.utils.book_append_sheet(wb, ws, nombre)
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${archivo('xlsx')}"`,
      'Cache-Control': 'no-store',
    },
  })
}
