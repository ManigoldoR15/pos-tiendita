'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { registroAction, type AuthState } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

export default function RegistroPage() {
  const t = useTranslations('registro')
  const [state, action, pending] = useActionState<AuthState, FormData>(
    registroAction,
    null,
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t('titulo')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitulo')}</p>
        </div>

        <form action={action} className="space-y-4">
          {state?.error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
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
              className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="contrasena" className="block text-sm font-medium">
              {t('contrasena')}
            </label>
            <input
              id="contrasena"
              name="contrasena"
              type="password"
              autoComplete="new-password"
              required
              placeholder={t('contrasenaPlaceholder')}
              className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmarContrasena"
              className="block text-sm font-medium"
            >
              {t('confirmarContrasena')}
            </label>
            <input
              id="confirmarContrasena"
              name="confirmarContrasena"
              type="password"
              autoComplete="new-password"
              required
              placeholder={t('confirmarContrasenaPlaceholder')}
              className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <Button
            type="submit"
            disabled={pending}
            className="h-12 w-full text-base"
          >
            {pending ? t('cargando') : t('botonRegistrar')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t('yaTieneCuenta')}{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t('linkLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}
