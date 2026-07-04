'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/superadmin'
import { createServiceClient } from '@/lib/supabase/service'
import type { ModulosConfig } from '@/lib/modulos-config'
import { textoCentavos } from '@/lib/dinero'

export type PagoState = { ok: true; periodoFin: string } | { error: string } | null

export async function registrarPagoAction(
  _prev: PagoState,
  formData: FormData,
): Promise<PagoState> {
  const { supabase } = await requireSuperAdmin()

  const negocioId = formData.get('negocio_id')?.toString()
  const montoTexto = formData.get('monto')?.toString() ?? ''
  const plan = formData.get('plan')?.toString()
  const fechaPago = formData.get('fecha_pago')?.toString() || undefined
  const metodo = formData.get('metodo')?.toString() || 'efectivo'
  const notas = formData.get('notas')?.toString().trim() || null

  const monto = textoCentavos(montoTexto)
  if (!negocioId) return { error: 'Negocio inválido.' }
  if (!montoTexto || monto <= 0) return { error: 'Escribe un monto válido mayor a cero.' }
  if (plan !== 'mensual' && plan !== 'anual') return { error: 'Elige plan mensual o anual.' }

  const { data, error } = await supabase.rpc('sa_registrar_pago', {
    p_negocio_id: negocioId,
    p_monto:      monto,
    p_plan:       plan,
    p_fecha_pago: fechaPago,
    p_metodo:     metodo,
    p_notas:      notas,
  })

  if (error) return { error: error.message }

  revalidatePath(`/superadmin/negocios/${negocioId}`)
  revalidatePath('/superadmin/negocios')
  revalidatePath('/superadmin')

  return { ok: true, periodoFin: (data as { periodo_fin: string }).periodo_fin }
}

export type SuscripcionState = { ok: true } | { error: string } | null

export async function actualizarSuscripcionAction(
  _prev: SuscripcionState,
  formData: FormData,
): Promise<SuscripcionState> {
  const supabase = await createClient()
  const { data: esSA } = await supabase.rpc('es_superadmin')
  if (!esSA) return { error: 'No autorizado.' }

  const negocioId    = formData.get('negocio_id')?.toString()
  const plan         = formData.get('plan')?.toString()
  const inicio       = formData.get('suscripcion_inicio')?.toString() || null
  const fin          = formData.get('suscripcion_fin')?.toString() || null
  const suspendido   = formData.get('suspendido') === 'true'
  const notasAdmin   = formData.get('notas_admin')?.toString().trim() || null
  const nombreNegocio = formData.get('nombre_negocio')?.toString().trim()
  const emailDueno   = formData.get('email_dueno')?.toString().trim().toLowerCase() || null
  const nombreDueno  = formData.get('nombre_dueno')?.toString().trim() || null
  const telefonoDueno = formData.get('telefono_dueno')?.toString().trim() || null
  const ubicacion    = formData.get('ubicacion')?.toString().trim() || null

  if (!negocioId || !plan || !nombreNegocio) return { error: 'Datos incompletos.' }
  if (!['prueba', 'mensual', 'anual'].includes(plan)) return { error: 'Plan inválido.' }

  const { error: updateError } = await supabase
    .from('negocios')
    .update({
      nombre:         nombreNegocio,
      email_dueno:    emailDueno,
      nombre_dueno:   nombreDueno,
      telefono_dueno: telefonoDueno,
      ubicacion,
    })
    .eq('id', negocioId)

  if (updateError) return { error: `Error al actualizar negocio: ${updateError.message}` }

  const { error: rpcError } = await supabase.rpc('actualizar_suscripcion', {
    p_negocio_id:         negocioId,
    p_plan:               plan,
    p_suscripcion_inicio: inicio,
    p_suscripcion_fin:    fin,
    p_suspendido:         suspendido,
    p_notas_admin:        notasAdmin,
  })

  if (rpcError) return { error: `Error al actualizar suscripción: ${rpcError.message}` }

  revalidatePath('/superadmin/negocios')
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  revalidatePath('/superadmin')

  return { ok: true }
}

export async function toggleDemoAction(negocioId: string, esDemo: boolean) {
  await requireSuperAdmin()
  const admin = createServiceClient()
  const { error } = await admin
    .from('negocios')
    .update({ es_demo: esDemo })
    .eq('id', negocioId)
  if (error) return { error: error.message }
  revalidatePath('/superadmin/negocios')
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  revalidatePath('/superadmin')
  return { ok: true }
}

export async function eliminarNegocioAction(negocioId: string, nombreConfirmacion: string) {
  const { supabase } = await requireSuperAdmin()

  const { data: negocio } = await supabase
    .from('negocios')
    .select('nombre')
    .eq('id', negocioId)
    .single()
  if (!negocio) return { error: 'Negocio no encontrado.' }
  if (negocio.nombre.trim().toLowerCase() !== nombreConfirmacion.trim().toLowerCase()) {
    return { error: `El nombre no coincide. Escribe exactamente "${negocio.nombre}" para confirmar.` }
  }

  const { data: huerfanos, error } = await supabase.rpc('sa_eliminar_negocio', {
    p_negocio_id: negocioId,
  })
  if (error) return { error: error.message }

  // Borrar de auth los usuarios que quedaron sin ningún negocio
  const admin = createServiceClient()
  for (const uid of (huerfanos as string[] | null) ?? []) {
    const { error: delError } = await admin.auth.admin.deleteUser(uid)
    if (delError) console.error('deleteUser:', uid, delError.message)
  }

  revalidatePath('/superadmin/negocios')
  revalidatePath('/superadmin')
  return { ok: true }
}

export async function toggleSuspenderAction(negocioId: string, suspender: boolean) {
  await requireSuperAdmin()
  const admin = createServiceClient()
  const { error } = await admin
    .from('negocios')
    .update({ suspendido: suspender })
    .eq('id', negocioId)
  if (error) return { error: error.message }
  revalidatePath('/superadmin/negocios')
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  return { ok: true }
}

export async function guardarNotasAdminAction(negocioId: string, notas: string) {
  await requireSuperAdmin()
  const admin = createServiceClient()
  const { error } = await admin
    .from('negocios')
    .update({ notas_admin: notas.trim() || null })
    .eq('id', negocioId)
  if (error) return { error: error.message }
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  return { ok: true }
}

export async function actualizarModulosAction(negocioId: string, modulos: ModulosConfig) {
  const { supabase } = await requireSuperAdmin()
  const { error } = await supabase.rpc('actualizar_modulos_negocio', {
    p_negocio_id: negocioId,
    p_modulos:    modulos,
  })
  if (error) return { error: error.message }
  revalidatePath('/superadmin/negocios')
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  return { ok: true }
}

export async function actualizarLicenciaPlazasAction(negocioId: string, maxPlazas: number) {
  const { supabase } = await requireSuperAdmin()
  const { error } = await supabase.rpc('actualizar_licencia_plazas', {
    p_negocio_id: negocioId,
    p_max_plazas: maxPlazas,
  })
  if (error) return { error: error.message }
  revalidatePath('/superadmin/negocios')
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  return { ok: true }
}

export async function actualizarLicenciaEmpleadosAction(negocioId: string, maxEmpleados: number) {
  const { supabase } = await requireSuperAdmin()
  const { error } = await supabase.rpc('actualizar_licencia_empleados', {
    p_negocio_id:    negocioId,
    p_max_empleados: maxEmpleados,
  })
  if (error) return { error: error.message }
  revalidatePath('/superadmin/negocios')
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  return { ok: true }
}

export async function actualizarLicenciaCajasAction(negocioId: string, maxCajas: number) {
  const { supabase } = await requireSuperAdmin()
  const { error } = await supabase.rpc('actualizar_licencia_cajas', {
    p_negocio_id: negocioId,
    p_max_cajas:  maxCajas,
  })
  if (error) return { error: error.message }
  revalidatePath('/superadmin/negocios')
  revalidatePath(`/superadmin/negocios/${negocioId}`)
  return { ok: true }
}
