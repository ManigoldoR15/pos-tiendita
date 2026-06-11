'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type AuthState = { error: string } | null

export async function loginAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('contrasena') as string,
  })

  if (error) {
    return { error: 'Correo o contraseña incorrectos' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function registroAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const contrasena = formData.get('contrasena') as string
  const confirmar = formData.get('confirmarContrasena') as string

  if (contrasena !== confirmar) {
    return { error: 'Las contraseñas no coinciden' }
  }

  if (contrasena.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: contrasena,
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: 'Ese correo ya está registrado' }
    }
    return { error: 'No se pudo crear la cuenta. Intenta de nuevo.' }
  }

  revalidatePath('/', 'layout')
  redirect('/crear-negocio')
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
