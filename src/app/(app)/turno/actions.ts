'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { hoyMX, mexicoDayRange } from '@/lib/fecha'

export async function registrarEntrada() {
  const supabase = await createClient()
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Evitar duplicados: si ya hay un turno activo hoy, solo redirigir
  const { start, end } = mexicoDayRange(hoyMX())
  const { data: activo } = await supabase
    .from('registros_turno')
    .select('id')
    .eq('user_id', user.id)
    .eq('negocio_id', negocio.id)
    .is('salida_at', null)
    .gte('entrada_at', start)
    .lte('entrada_at', end)
    .maybeSingle()

  if (!activo) {
    const emailPrefix = user.email?.split('@')[0] ?? 'empleado'
    const nombre = emailPrefix
      .split(/[._-]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    // Congelar la plaza asignada al momento de la entrada (histórico exacto)
    const { data: miembro } = await supabase
      .from('usuarios_negocio')
      .select('local_id')
      .eq('negocio_id', negocio.id)
      .eq('user_id', user.id)
      .maybeSingle()

    await supabase.from('registros_turno').insert({
      negocio_id: negocio.id,
      user_id: user.id,
      nombre,
      local_id: miembro?.local_id ?? null,
    })
  }

  redirect('/turno')
}

export async function registrarSalida(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('registros_turno')
    .update({ salida_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  redirect('/turno')
}
