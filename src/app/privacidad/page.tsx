import type { Metadata } from 'next'
import Link from 'next/link'
import { Store, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Aviso de privacidad — POS Tiendita',
  description:
    'Cómo POS Tiendita recopila, usa y protege los datos de los negocios que usan la plataforma.',
}

const ACTUALIZADO = '12 de julio de 2026'
const TELEFONO_DISPLAY = '775 102 4002'
const TELEFONO_TEL = 'tel:+527751024002'
const WHATSAPP = 'https://wa.me/527751024002'

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold tracking-tight">{titulo}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/inicio" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Store className="h-4.5 w-4.5" />
            </div>
            <span className="font-bold tracking-tight">POS Tiendita</span>
          </Link>
          <Link
            href="/inicio"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="eyebrow text-primary">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Aviso de privacidad</h1>
        <p className="mt-3 text-sm text-muted-foreground">Última actualización: {ACTUALIZADO}</p>

        <p className="mt-8 leading-relaxed text-muted-foreground">
          POS Tiendita (en adelante, &ldquo;la plataforma&rdquo;) es un sistema de punto de venta
          para negocios en México. Este aviso explica, en palabras simples, qué datos recopilamos,
          para qué los usamos y cómo los protegemos, conforme a la Ley Federal de Protección de
          Datos Personales en Posesión de los Particulares (LFPDPPP). El responsable del
          tratamiento de los datos es el operador de POS Tiendita, con contacto en el teléfono{' '}
          <a href={TELEFONO_TEL} className="font-medium text-foreground hover:text-primary">
            {TELEFONO_DISPLAY}
          </a>
          .
        </p>

        <Seccion titulo="Qué datos recopilamos">
          <p>
            <strong className="text-foreground">De tu cuenta:</strong> correo electrónico y
            contraseña (la contraseña se guarda cifrada; nadie puede leerla, ni nosotros).
          </p>
          <p>
            <strong className="text-foreground">De tu negocio:</strong> la información que tú
            registras para operar — ventas, productos, inventario, gastos, cortes de caja,
            proveedores y, si los capturas, datos de tus clientes (nombre y teléfono para fiados o
            apartados).
          </p>
          <p>
            <strong className="text-foreground">De tu equipo:</strong> si el dueño del negocio lo
            captura, nombre, edad y sexo de sus empleados (campos opcionales, para su propio
            control de personal).
          </p>
          <p>
            <strong className="text-foreground">Ubicación (solo módulo de reparto):</strong> si tu
            negocio contrata el rastreo de repartidores, la plataforma registra la ubicación GPS
            del repartidor mientras tiene la página abierta y solo si él acepta el permiso de
            ubicación en su teléfono. Los recorridos se conservan 30 días y luego se borran.
          </p>
          <p>
            <strong className="text-foreground">De seguridad:</strong> dirección IP y tipo de
            navegador al iniciar sesión, para detectar accesos no autorizados a tu cuenta.
          </p>
        </Seccion>

        <Seccion titulo="Para qué usamos los datos">
          <p>
            Únicamente para operar la plataforma: mostrarte tus ventas y reportes, respaldar tu
            información, darte soporte, cobrar el servicio y proteger tu cuenta. No usamos tus
            datos para publicidad ni los vendemos o rentamos a terceros.
          </p>
        </Seccion>

        <Seccion titulo="Dónde se guardan">
          <p>
            Tu información se almacena en servicios profesionales de nube con cifrado en tránsito
            y en reposo: Supabase (base de datos) y Railway (servidores de la aplicación). Estos
            proveedores procesan los datos por cuenta de POS Tiendita y no pueden usarlos para
            fines propios. Si tu negocio paga por suscripción con tarjeta, el pago lo procesa una
            pasarela de pagos certificada; nosotros nunca vemos ni guardamos tu número de tarjeta.
          </p>
        </Seccion>

        <Seccion titulo="Responsabilidad del negocio que usa la plataforma">
          <p>
            Cada negocio es responsable de los datos que captura de sus propios clientes y
            empleados. Si contratas el módulo de rastreo, debes informar a tus repartidores que su
            ubicación se registra durante su jornada — la plataforma, además, les pide su permiso
            directamente en el teléfono antes de activar el GPS.
          </p>
        </Seccion>

        <Seccion titulo="Tus derechos (ARCO)">
          <p>
            Puedes solicitar en cualquier momento el acceso, rectificación, cancelación u
            oposición sobre tus datos personales, así como la eliminación completa de tu cuenta y
            la información de tu negocio. Basta con contactarnos por{' '}
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary"
            >
              WhatsApp
            </a>{' '}
            o al teléfono{' '}
            <a href={TELEFONO_TEL} className="font-medium text-foreground hover:text-primary">
              {TELEFONO_DISPLAY}
            </a>
            . Respondemos en un máximo de 20 días hábiles.
          </p>
        </Seccion>

        <Seccion titulo="Cookies">
          <p>
            La plataforma usa únicamente cookies necesarias para mantener tu sesión iniciada y
            proteger tu cuenta. No usamos cookies de publicidad ni de rastreo de terceros.
          </p>
        </Seccion>

        <Seccion titulo="Cambios a este aviso">
          <p>
            Si este aviso cambia, publicaremos aquí la versión nueva con su fecha de
            actualización. Los cambios importantes se avisarán dentro de la plataforma.
          </p>
        </Seccion>
      </main>

      <footer className="border-t border-border px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            POS Tiendita · Hecho en México 🇲🇽
          </p>
          <a href={TELEFONO_TEL} className="font-medium text-foreground hover:text-primary">
            {TELEFONO_DISPLAY}
          </a>
        </div>
      </footer>
    </div>
  )
}
