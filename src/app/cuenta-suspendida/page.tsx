import Link from 'next/link'

export default function CuentaSuspendidaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-3xl">
            🔒
          </span>
        </div>
        <h1 className="text-2xl font-bold">Cuenta suspendida</h1>
        <p className="text-muted-foreground">
          El acceso a tu negocio ha sido suspendido temporalmente.
          Para reactivarlo, comunícate con soporte.
        </p>
        <div className="rounded-xl border bg-card p-4 text-sm text-left space-y-1">
          <p className="font-semibold">Contacto de soporte:</p>
          <p className="text-muted-foreground">2230931@upt.edu.mx</p>
        </div>
        <Link
          href="/login"
          className="inline-block rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  )
}
