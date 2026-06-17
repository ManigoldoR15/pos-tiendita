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
    if (error.message === 'Email not confirmed') {
      return { error: 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada (y la carpeta de spam).' }
    }
    return { error: 'Correo o contraseña incorrectos' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}


export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
