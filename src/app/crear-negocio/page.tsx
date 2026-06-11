'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { crearNegocioAction, type CrearNegocioState } from './actions'

export default function CrearNegocioPage() {
  const t = useTranslations('crearNegocio')
  const [state, action, pending] = useActionState<CrearNegocioState, FormData>(
    crearNegocioAction,
    null,
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
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
            <label htmlFor="nombre" className="block text-sm font-medium">
              {t('nombreLabel')}
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              required
              autoFocus
              placeholder={t('nombrePlaceholder')}
              className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <Button
            type="submit"
            disabled={pending}
            className="h-14 w-full text-lg font-semibold"
          >
            {pending ? t('cargando') : t('botonCrear')}
          </Button>
        </form>
      </div>
    </div>
  )
}
