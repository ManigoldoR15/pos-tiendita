'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { ModulosConfig } from '@/lib/modulos-config'

export type NuevoClienteState = { error: string } | null

// Flujo de alta ÚNICO (Fase 4): fusiona el alta completa del viejo
// admin-sistema (datos + plan + invitación por email) con el alta rápida
// del modal "Nuevo negocio" (contraseña asignada al momento).

export async function crearClienteAction(
  _prev: NuevoClienteState,
  formData: FormData,
): Promise<NuevoClienteState> {
  const supabase = await createClient()
  const { data: esSA } = await supabase.rpc('es_superadmin')
  if (!esSA) return { error: 'No autorizado.' }

  const nombre      = formData.get('nombre')?.toString().trim()
  const emailDueno  = formData.get('email_dueno')?.toString().trim().toLowerCase()
  const nombreDueno = formData.get('nombre_dueno')?.toString().trim()
  const telefono    = formData.get('telefono_dueno')?.toString().trim() || null
  const ubicacion   = formData.get('ubicacion')?.toString().trim() || null
  const paqPos        = formData.get('paq_pos') === 'on'
  const paqRastreador = formData.get('paq_rastreador') === 'on'
  const modoAcceso  = formData.get('modo_acceso')?.toString() ?? 'invitacion'
  const password    = formData.get('password')?.toString().trim() ?? ''

  if (!nombre || !emailDueno || !nombreDueno) {
    return { error: 'Nombre del negocio, email y nombre del dueño son obligatorios.' }
  }
  if (!paqPos && !paqRastreador) {
    return { error: 'Elige al menos un paquete comprado.' }
  }
  if (modoAcceso === 'password' && password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  const service = createServiceClient()

  // Resolver la cuenta del dueño:
  //   - si ya existe una cuenta con ese email, se reutiliza (sin invitación);
  //   - si no: invitación por email o cuenta con contraseña, según el modo.
  const { data: { users } } = await service.auth.admin.listUsers()
  const existente = users.find((u) => u.email === emailDueno)

  let userId: string
  if (existente) {
    userId = existente.id
  } else if (modoAcceso === 'password') {
    const { data: nuevo, error: createErr } = await service.auth.admin.createUser({
      email: emailDueno,
      password,
      email_confirm: true,
    })
    if (createErr || !nuevo?.user) {
      return { error: 'No se pudo crear la cuenta del dueño. Intenta de nuevo.' }
    }
    userId = nuevo.user.id
  } else {
    const { data: invite, error: inviteError } = await service.auth.admin.inviteUserByEmail(
      emailDueno,
      { data: { nombre_negocio: nombre } },
    )
    if (inviteError || !invite?.user) {
      return { error: 'No se pudo enviar la invitación. Intenta de nuevo.' }
    }
    userId = invite.user.id
  }

  // Módulos según los paquetes comprados:
  //   POS completo → módulos base del punto de venta
  //   Rastreador   → módulo repartidores (si no lo compró, la sección no aparece)
  const modulos: ModulosConfig = {
    fiados:              paqPos,
    granel:              paqPos,
    turnos:              paqPos,
    exportacion:         paqPos,
    multi_plaza:         paqPos,
    clientes_frecuentes: paqPos,
    proveedores:         paqPos,
    metas:               paqPos,
    repartidores:        paqRastreador,
    variantes:           false, // se activa por giro (ropa) o desde Módulos
  }

  // Crear el negocio (service role bypasea RLS).
  // plan 'compra' = pago único; suscripcion_inicio guarda la fecha de compra.
  const hoy = new Date().toISOString().split('T')[0]
  const { data: negocio, error: negocioError } = await service
    .from('negocios')
    .insert({
      nombre,
      owner_id:      userId,
      email_dueno:   emailDueno,
      nombre_dueno:  nombreDueno,
      telefono_dueno: telefono,
      ubicacion,
      plan: 'compra',
      suscripcion_inicio: hoy,
      modulos_habilitados: modulos,
    })
    .select('id')
    .single()

  if (negocioError || !negocio) {
    return { error: 'No se pudo crear el negocio. Intenta de nuevo.' }
  }

  // Vincular dueño al negocio
  const { error: rolError } = await service
    .from('usuarios_negocio')
    .insert({ negocio_id: negocio.id, user_id: userId, rol: 'dueno' })

  if (rolError) return { error: 'No se pudo vincular al dueño con el negocio. Intenta de nuevo.' }

  revalidatePath('/superadmin/negocios')
  revalidatePath('/superadmin')
  redirect(`/superadmin/negocios/${negocio.id}`)
}
