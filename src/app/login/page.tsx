'use client'

import { useActionState } from 'react'
import { loginAction, type AuthState } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { Store } from 'lucide-react'

export default function LoginPage() {
  const t = useTranslations('login')
  const [state, action, pending] = useActionState<AuthState, FormData>(
    loginAction,
    null,
  )

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      {/* Gradiente de fondo sutil — da profundidad sin saturar */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent" />

      <div className="card-soft relative w-full max-w-sm space-y-8 p-8">
        {/* Brand mark */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_4px_20px_-4px_rgb(0_0_0/0.25)]">
            <Store className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('titulo')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitulo')}</p>
          </div>
        </div>

        <form action={action} className="space-y-5">
          {state?.error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium">
              {t('correo')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder={t('correoPlaceholder')}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-3 focus:ring-primary/15"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="contrasena" className="block text-sm font-medium">
              {t('contrasena')}
            </label>
            <input
              id="contrasena"
              name="contrasena"
              type="password"
              autoComplete="current-password"
              required
              placeholder={t('contrasenaPlaceholder')}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-3 focus:ring-primary/15"
            />
          </div>

          <Button
            type="submit"
            disabled={pending}
            className="h-13 w-full rounded-xl text-base font-semibold shadow-[0_4px_16px_-2px_rgb(0_0_0/0.18)] hover:shadow-[0_6px_20px_-2px_rgb(0_0_0/0.22)] transition-shadow"
          >
            {pending ? t('cargando') : t('botonEntrar')}
          </Button>
        </form>
      </div>
    </div>
  )
}
