import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getNegocioActual } from '@/lib/negocio'
import { logoutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const negocio = await getNegocioActual()

  if (!negocio) {
    redirect('/crear-negocio')
  }

  const t = await getTranslations('dashboard')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <h1 className="text-2xl font-bold">
        {t('saludo', { nombre: negocio.nombre })}
      </h1>

      <form action={logoutAction}>
        <Button type="submit" variant="outline">
          {t('botonCerrarSesion')}
        </Button>
      </form>
    </div>
  )
}
