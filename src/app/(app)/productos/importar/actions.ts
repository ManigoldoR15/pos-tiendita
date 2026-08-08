'use server'

import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import type { FilaImport } from './importar-client'

export async function importarProductosAction(
  filas: FilaImport[],
  localId?: string | null,
): Promise<{ ok: number; errores: number }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { ok: 0, errores: filas.length }

  const supabase = await createClient()

  // Plaza donde entra todo el catálogo importado. Se verifica contra el negocio
  // porque lotes_producto no comprueba la pertenencia del local; un id que no
  // sea de aquí entra como null (general) en vez de guardarse a ciegas.
  let local_id: string | null = null
  if (localId) {
    const { data } = await supabase
      .from('locales')
      .select('id')
      .eq('id', localId)
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .maybeSingle()
    local_id = data?.id ?? null
  }

  let ok = 0
  let errores = 0

  const hoyMx = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

  const LOTE = 100
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE)
    const validas = lote.filter((f) => !f.error && f.nombre && f.precio_venta > 0)
    // El stock entra como lote, no como existencias sueltas: registrar_venta
    // consume por lotes (FEFO) y un producto sin lote no se puede cobrar.
    const rows = validas.map((f) => ({
      negocio_id: negocio.id,
      nombre: f.nombre.trim(),
      precio_venta: f.precio_venta,
      precio_costo: f.precio_costo > 0 ? f.precio_costo : null,
      existencias: 0,
      codigo_barras: f.codigo_barras || null,
      activo: true,
    }))

    if (rows.length === 0) {
      errores += lote.length
      continue
    }

    const { error, data } = await supabase
      .from('productos')
      .insert(rows)
      .select('id, nombre') as { error: unknown; data: { id: string; nombre: string }[] | null }

    const insertados = data?.length ?? 0
    ok += insertados
    errores += rows.length - insertados + (lote.length - rows.length)
    if (error) errores += rows.length - insertados

    // Lote inicial por cada producto con stock. El trigger trg_sync_existencias
    // deja productos.existencias en la suma de sus lotes.
    if (data && insertados > 0) {
      // Postgres devuelve las filas en el orden en que se insertaron, así que
      // data[n] corresponde a validas[n]. Si por lo que sea no cuadran las
      // longitudes, se emparejan por nombre y las repetidas se toman en orden.
      const porNombre = new Map<string, number[]>()
      if (insertados !== validas.length) {
        validas.forEach((f, idx) => {
          const nombre = f.nombre.trim()
          porNombre.set(nombre, [...(porNombre.get(nombre) ?? []), idx])
        })
      }

      const lotesIniciales = data
        .map((p, idx) => {
          if (insertados === validas.length) return { id: p.id, cantidad: validas[idx].existencias }
          const pendientes = porNombre.get(p.nombre) ?? []
          const origen = pendientes.shift()
          return { id: p.id, cantidad: origen === undefined ? 0 : validas[origen].existencias }
        })
        .filter((x) => x.cantidad > 0)
        .map((x) => ({
          negocio_id: negocio.id,
          producto_id: x.id,
          cantidad: x.cantidad,
          cantidad_actual: x.cantidad,
          fecha_recepcion: hoyMx,
          ubicacion: 'ambiente',
          local_id,
          notas: 'Stock inicial de importación',
          activo: true,
        }))

      if (lotesIniciales.length > 0) {
        await supabase.from('lotes_producto').insert(lotesIniciales)
      }
    }
  }

  return { ok, errores }
}
