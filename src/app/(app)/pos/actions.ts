'use server'

import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { notificar } from '@/lib/notificaciones'
import { formatMXN } from '@/lib/dinero'

type ItemVenta = { producto_id: string; cantidad: number; es_fiado?: boolean }

export type ClienteSugerido = {
  id: string
  nombre: string
  telefono: string | null
  en_lista_negra: boolean
  motivo_lista_negra: string | null
  estatus: 'verde' | 'amarillo' | 'rojo' | null
  estatus_nota: string | null
}

export async function registrarVentaAction(params: {
  items: ItemVenta[]
  metodo_pago_id: string
  pago_recibido: number | null
  descuento?: number
  cliente_id?: string | null
}): Promise<{ venta_id: string } | { error: string }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Determinar plaza del empleado (NULL si no tiene asignación — negocios sin
  // multi-plaza o dueños que venden desde cualquier ubicación)
  let localId: string | null = null
  if (user) {
    const { data: miembro } = await supabase
      .from('usuarios_negocio')
      .select('local_id')
      .eq('negocio_id', negocio.id)
      .eq('user_id', user.id)
      .maybeSingle()
    localId = miembro?.local_id ?? null
  }

  const { data, error } = await supabase.rpc('registrar_venta', {
    p_negocio_id: negocio.id,
    p_items: params.items,
    p_metodo_pago_id: params.metodo_pago_id,
    p_cliente_id: params.cliente_id ?? null,
    p_pago_recibido: params.pago_recibido,
    p_descuento: params.descuento ?? 0,
    p_vendedor_id: user?.id ?? null,
    p_local_id: localId,
  })

  if (error) return { error: error.message }

  // Fire-and-forget: notificar si hay fiado (no bloquea ni rompe si falla)
  const esFiado = params.items.some((i) => i.es_fiado)
  if (esFiado && params.cliente_id) {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('nombre, en_lista_negra')
      .eq('id', params.cliente_id)
      .eq('negocio_id', negocio.id)
      .maybeSingle()

    const esListaNegra = cliente?.en_lista_negra ?? false
    notificar({
      negocio_id: negocio.id,
      tipo: esListaNegra ? 'fiado_lista_negra' : 'fiado',
      titulo: esListaNegra
        ? '¡Fiado a cliente en lista negra!'
        : 'Se fió a un cliente',
      mensaje: `${esListaNegra ? '⚠ ' : ''}Fiado a ${cliente?.nombre ?? 'cliente desconocido'}${esListaNegra ? ' (lista negra)' : ''}.`,
      url: params.cliente_id ? `/fiados/${params.cliente_id}` : '/fiados',
      creado_por: user?.id ?? null,
    })
  }

  return { venta_id: data as string }
}

export async function buscarClientesAction(q: string): Promise<ClienteSugerido[]> {
  const term = q.trim()
  if (term.length < 2) return []
  const negocio = await getNegocioActual()
  if (!negocio) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, en_lista_negra, motivo_lista_negra, estatus, estatus_nota')
    .eq('negocio_id', negocio.id)
    .eq('activo', true)
    .or(`nombre.ilike.%${term}%,telefono.ilike.%${term}%`)
    .order('nombre')
    .limit(6)

  return data ?? []
}

export async function getPreciosEspecialesPOSAction(
  clienteId: string,
): Promise<Record<string, { tipo: 'porcentaje' | 'monto_fijo'; valor: number }>> {
  const negocio = await getNegocioActual()
  if (!negocio) return {}

  const supabase = await createClient()
  const { data } = await supabase
    .from('precios_especiales_cliente')
    .select('producto_id, tipo, valor')
    .eq('negocio_id', negocio.id)
    .eq('cliente_id', clienteId)

  return Object.fromEntries(
    (data ?? []).map((r) => [r.producto_id, { tipo: r.tipo as 'porcentaje' | 'monto_fijo', valor: r.valor }]),
  )
}

export async function crearClienteAction(
  nombre: string,
  telefono?: string,
): Promise<ClienteSugerido | { error: string }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'No hay negocio activo' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .insert({
      negocio_id: negocio.id,
      nombre: nombre.trim(),
      telefono: telefono?.trim() || null,
    })
    .select('id, nombre, telefono, en_lista_negra, motivo_lista_negra, estatus, estatus_nota')
    .single()

  if (error) return { error: error.message }
  return data as ClienteSugerido
}
