'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'

export async function registrarEntrada() {
  const supabase = await createClient()
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const emailPrefix = user.email?.split('@')[0] ?? 'empleado'
  const nombre = emailPrefix
    .split(/[._-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  await supabase.from('registros_turno').insert({
    negocio_id: negocio.id,
    user_id: user.id,
    nombre,
  })

  revalidatePath('/turno')
  revalidatePath('/')
}

export async function registrarSalida(id: string) {
  const supabase = await createClient()

  await supabase
    .from('registros_turno')
    .update({ salida_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')

  revalidatePath('/turno')
  revalidatePath('/')
}
