'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Store,
  Barcode,
  Package,
  Users,
  Clock,
  Tag,
  ShoppingCart,
  MapPin,
  Route,
  Bell,
  PackageCheck,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  ShieldCheck,
  Phone,
  MessageCircle,
  Check,
  Truck,
  Shirt,
  Pill,
  Hammer,
  PencilRuler,
  SlidersHorizontal,
  BarChart3,
  Printer,
} from 'lucide-react'

const TELEFONO_DISPLAY = '775 102 4002'
const TELEFONO_TEL = 'tel:+527751024002'
const WHATSAPP = `https://wa.me/527751024002?text=${encodeURIComponent(
  'Hola, me interesa el sistema POS con rastreo de flotilla. ¿Me pueden dar más información?',
)}`

/* ─── Animación de aparición al hacer scroll ─── */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'transition-all duration-700 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ─── Título del hero: palabras que suben una por una ─── */
function TituloAnimado({ texto, acento }: { texto: string; acento: string }) {
  const palabras = [
    ...texto.split(' ').map((w) => ({ w, esAcento: false })),
    ...acento.split(' ').map((w) => ({ w, esAcento: true })),
  ]
  return (
    <h1 className="text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
      {palabras.map((p, idx) => (
        <Fragment key={idx}>
          <span className="inline-block overflow-hidden pb-1 align-bottom">
            <span
              className={cn(
                'inline-block translate-y-full opacity-0 [animation:landing-rise_0.7s_cubic-bezier(0.22,1,0.36,1)_forwards]',
                p.esAcento &&
                  'bg-gradient-to-r from-primary via-teal-500 to-emerald-500 bg-clip-text text-transparent dark:from-teal-300 dark:via-teal-400 dark:to-emerald-400',
              )}
              style={{ animationDelay: `${120 + idx * 90}ms` }}
            >
              {p.w}
            </span>
          </span>{' '}
        </Fragment>
      ))}
    </h1>
  )
}

/* ─── Tarjeta de función ─── */
function Funcion({
  icon: Icon,
  titulo,
  children,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>
  titulo: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <Reveal delay={delay}>
      <div className="card-soft group h-full p-6 transition-transform duration-300 hover:-translate-y-1">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
          <Icon className="h-5.5 w-5.5" />
        </div>
        <h3 className="mb-1.5 font-semibold">{titulo}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </Reveal>
  )
}

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <style>{`
        @keyframes landing-rise {
          /* Tailwind v4 aplica translate-y-full con la propiedad \`translate\`
             (no \`transform\`) — hay que animar esa misma propiedad */
          to { translate: 0 0; opacity: 1; }
        }
        @keyframes landing-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes landing-ping {
          0% { transform: scale(1); opacity: 0.7; }
          80%, 100% { transform: scale(2.8); opacity: 0; }
        }
        @keyframes landing-ruta {
          to { stroke-dashoffset: 0; }
        }
        @keyframes landing-barra {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        @media (prefers-reduced-motion: no-preference) {
          html { scroll-behavior: smooth; }
        }
      `}</style>

      {/* ─── NAV ─── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_2px_12px_-2px_rgb(0_0_0/0.3)]">
              <Store className="h-4.5 w-4.5" />
            </div>
            <span className="font-bold tracking-tight">POS Tiendita</span>
          </a>
          <div className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#funciones" className="transition-colors hover:text-foreground">Punto de venta</a>
            <a href="#rastreo" className="transition-colors hover:text-foreground">Rastreo</a>
            <a href="#finanzas" className="transition-colors hover:text-foreground">Finanzas</a>
            <a href="#adapta" className="transition-colors hover:text-foreground">Se adapta a ti</a>
            <a href="#precios" className="transition-colors hover:text-foreground">Precios</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Entrar
            </Link>
            <a
              href="#contacto"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgb(0_0_0/0.4)] transition-all hover:brightness-110"
            >
              Contáctanos
            </a>
          </div>
        </nav>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative px-4 pb-20 pt-32 sm:px-6 sm:pt-40">
        {/* Resplandor de fondo */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl dark:bg-primary/15" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <Reveal>
              <p className="eyebrow mb-5 flex items-center gap-2 text-primary">
                <Truck className="h-4 w-4" />
                Punto de venta + rastreo de flotilla
              </p>
            </Reveal>
            <TituloAnimado texto="Todo tu negocio," acento="bajo control." />
            <Reveal delay={500}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Ventas, inventario, finanzas y tus repartidores en tiempo real —
                en un solo sistema, hecho para negocios mexicanos. Sin
                complicaciones técnicas.
              </p>
            </Reveal>
            <Reveal delay={650}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_rgb(0_0_0/0.5)] transition-all hover:-translate-y-0.5 hover:brightness-110"
                >
                  <MessageCircle className="h-5 w-5" />
                  Escríbenos por WhatsApp
                </a>
                <a
                  href="#precios"
                  className="rounded-xl border border-border bg-card px-6 py-3.5 font-semibold transition-all hover:-translate-y-0.5 hover:border-primary/40"
                >
                  Ver precios
                </a>
              </div>
            </Reveal>
            <Reveal delay={800}>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {['Pago único por sistema', 'Funciona en celular y computadora', 'Soporte directo'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" />
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Mock del dashboard */}
          <Reveal delay={300} className="[animation:landing-float_9s_ease-in-out_infinite]">
            <div className="card-soft relative mx-auto w-full max-w-md p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="eyebrow">Hoy</p>
                  <p className="text-sm text-muted-foreground">Resumen del día</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 [animation:landing-ping_2s_ease-out_infinite]" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  3 repartidores en ruta
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Ventas', valor: '$12,480', clase: 'num-income' },
                  { label: 'Gastos', valor: '$3,150', clase: 'num-expense' },
                  { label: 'Utilidad', valor: '$9,330', clase: 'num-income' },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className={cn('mt-0.5 text-base font-bold sm:text-lg', k.clase)}>{k.valor}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <p className="mb-3 text-xs font-medium text-muted-foreground">Ventas de la semana</p>
                <div className="flex h-24 items-end gap-2">
                  {[45, 62, 38, 74, 58, 92, 70].map((h, idx) => (
                    <div
                      key={idx}
                      className="flex-1 origin-bottom rounded-md bg-primary/80 [animation:landing-barra_0.8s_cubic-bezier(0.22,1,0.36,1)_both]"
                      style={{ height: `${h}%`, animationDelay: `${700 + idx * 80}ms` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, idx) => (
                    <span key={idx} className="flex-1 text-center">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── PUNTO DE VENTA ─── */}
      <section id="funciones" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="eyebrow mb-3 text-primary">Punto de venta</p>
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Cobra rápido y sin errores, aunque no sepas de sistemas
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Pantalla táctil con botones grandes, pensada para el mostrador.
              El sistema calcula el cambio y descuenta el inventario solo.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Funcion icon={Barcode} titulo="Ventas en segundos" delay={0}>
              Escanea el código de barras o toca el producto en pantalla. Vende
              por pieza o a granel, y si te pagan con $500 el sistema te dice
              cuánto cambio dar.
            </Funcion>
            <Funcion icon={Package} titulo="Inventario al día" delay={80}>
              Cada venta descuenta existencias automáticamente. Con alertas de
              stock bajo y de productos por caducar.
            </Funcion>
            <Funcion icon={Users} titulo="Clientes y fiados" delay={160}>
              Lleva la cuenta de quién te debe y cuánto, sin libreta. Registra
              abonos y quedas en paz.
            </Funcion>
            <Funcion icon={Clock} titulo="Turnos y corte de caja" delay={0}>
              Apertura con monto inicial, cierre con conteo físico y la
              diferencia calculada sola. Se acabaron los descuadres misteriosos.
            </Funcion>
            <Funcion icon={Tag} titulo="Listas de precio por plaza" delay={80}>
              ¿Vendes en varios lugares o a distintos tipos de cliente? Maneja
              precios diferentes sin batallar.
            </Funcion>
            <Funcion icon={ShoppingCart} titulo="Compras y proveedores" delay={160}>
              Registra la mercancía que compras, con costos por lote, para saber
              cuánto te está dejando realmente cada producto.
            </Funcion>
          </div>
        </div>
      </section>

      {/* ─── RASTREADOR ─── */}
      <section id="rastreo" className="scroll-mt-20 bg-secondary/50 px-4 py-20 sm:px-6 sm:py-28 dark:bg-secondary/30">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          {/* Mock del mapa */}
          <Reveal className="order-2 lg:order-1">
            <div className="card-soft relative overflow-hidden p-0">
              <svg viewBox="0 0 400 300" className="w-full" role="img" aria-label="Mapa de rastreo en tiempo real">
                {/* Fondo de calles */}
                <rect width="400" height="300" className="fill-card" />
                <g className="stroke-border" strokeWidth="6">
                  <line x1="0" y1="80" x2="400" y2="70" />
                  <line x1="0" y1="170" x2="400" y2="185" />
                  <line x1="0" y1="250" x2="400" y2="245" />
                  <line x1="90" y1="0" x2="80" y2="300" />
                  <line x1="210" y1="0" x2="220" y2="300" />
                  <line x1="330" y1="0" x2="325" y2="300" />
                </g>
                {/* Ruta recorrida */}
                <path
                  d="M 40 260 L 82 252 L 85 180 L 216 190 L 212 74 L 300 70"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="600"
                  strokeDashoffset="600"
                  className="stroke-primary [animation:landing-ruta_3s_ease-out_0.4s_forwards]"
                />
                {/* Paradas */}
                <circle cx="40" cy="260" r="6" className="fill-muted-foreground" />
                <circle cx="85" cy="180" r="6" className="fill-muted-foreground" />
                {/* Repartidor actual */}
                <circle cx="300" cy="70" r="16" className="fill-primary/20">
                  <animate attributeName="r" values="10;22;10" dur="2.2s" repeatCount="indefinite" />
                </circle>
                <circle cx="300" cy="70" r="8" className="fill-primary" />
              </svg>
              <div className="absolute left-4 top-4 rounded-xl bg-background/90 px-3.5 py-2.5 shadow-lg backdrop-blur">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  Juan — En ruta
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Última señal: hace 1 min</p>
              </div>
              <div className="absolute bottom-4 right-4 rounded-xl bg-background/90 px-3.5 py-2.5 shadow-lg backdrop-blur">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <PackageCheck className="h-3.5 w-3.5" />
                  Entrega confirmada · 10:42
                </p>
              </div>
            </div>
          </Reveal>

          <div className="order-1 lg:order-2">
            <Reveal>
              <p className="eyebrow mb-3 text-primary">Rastreador de flotilla</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Sabes dónde está tu gente y tu mercancía, siempre
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Si tus vendedores o repartidores salen a la calle, deja de
                adivinar. Míralos en el mapa desde tu celular o computadora.
              </p>
            </Reveal>
            <div className="mt-8 space-y-6">
              {[
                {
                  icon: MapPin,
                  titulo: 'Ubicación en tiempo real',
                  desc: 'Cada repartidor aparece en el mapa y su ruta sigue las calles de verdad, no líneas rectas.',
                },
                {
                  icon: Route,
                  titulo: 'Bitácora de paradas',
                  desc: 'Cada parada queda registrada con hora y lugar. Al final del día ves el recorrido completo.',
                },
                {
                  icon: PackageCheck,
                  titulo: 'Entrega de carga confirmada',
                  desc: 'El repartidor confirma la mercancía que recibe y la que entrega. Nada se pierde en el camino.',
                },
                {
                  icon: Bell,
                  titulo: 'Alertas y avisos directos',
                  desc: 'Recibe alertas de la flotilla y mándale avisos a tu gente sin salir del sistema.',
                },
              ].map((f, idx) => (
                <Reveal key={f.titulo} delay={idx * 100}>
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <f.icon className="h-5.5 w-5.5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{f.titulo}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FINANZAS Y REPORTES ─── */}
      <section id="finanzas" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="eyebrow mb-3 text-primary">Cuentas claras</p>
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Finanzas y reportes sin dolor de cabeza
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Deja de hacer cuentas en servilletas. El sistema te dice cuánto
              ganaste de verdad — hoy, esta semana o este mes — y te saca
              reportes de todo con un botón.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Funcion icon={TrendingUp} titulo="Tu ganancia real, al instante" delay={0}>
              El tablero resta gastos y costo de la mercancía a tus ventas:
              sabes cuánto te queda de verdad. Filtra por hoy, semana, mes o el
              rango que quieras.
            </Funcion>
            <Funcion icon={BarChart3} titulo="Tus productos estrella" delay={80}>
              Ve qué se vende más — por piezas y por dinero — para surtir lo
              que sí deja y dejar de invertir en lo que no se mueve.
            </Funcion>
            <Funcion icon={Printer} titulo="Reportes de todo" delay={160}>
              Ventas, gastos, inventario, cortes de caja y estados de cuenta de
              fiados. Los imprimes o los guardas en PDF cuando quieras.
            </Funcion>
            <Funcion icon={FileSpreadsheet} titulo="Exporta a Excel" delay={0}>
              Tus ventas, gastos y movimientos se descargan en Excel, listos
              para tu contador o para revisarlos tú con calma.
            </Funcion>
            <Funcion icon={Receipt} titulo="Gastos por categoría" delay={80}>
              Luz, renta, gasolina, sueldos, mercancía... y separa los gastos
              personales de los del negocio, para no engañarte con los números.
            </Funcion>
            <Funcion icon={ShieldCheck} titulo="Roles y permisos" delay={160}>
              Cada empleado ve solo lo que le toca. Tú ves todo, desde donde
              estés — en tu celular o computadora.
            </Funcion>
          </div>
        </div>
      </section>

      {/* ─── SE ADAPTA A TU NEGOCIO ─── */}
      <section id="adapta" className="scroll-mt-20 bg-secondary/50 px-4 py-20 sm:px-6 sm:py-28 dark:bg-secondary/30">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="eyebrow mb-3 text-primary">Hecho a tu medida</p>
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Se adapta a tu negocio, no al revés
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Nos dices a qué te dedicas y el sistema se configura solo:
              categorías, gastos y funciones según tu giro. Está pensado para
              el negocio de a pie — cobras sin pedirle datos a nadie, sin
              trámites y sin complicarte.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Funcion icon={Store} titulo="Abarrotes y tienditas" delay={0}>
              Venta por pieza o a granel, control de caducidades para que nada
              se te eche a perder, y los fiados de la libreta ahora en el
              sistema.
            </Funcion>
            <Funcion icon={Shirt} titulo="Ropa y calzado" delay={80}>
              Cada prenda con sus tallas y colores, y apartados con anticipo y
              fecha límite — el sistema reserva la prenda y lleva los abonos.
            </Funcion>
            <Funcion icon={Pill} titulo="Farmacias" delay={160}>
              Categorías listas para empezar y control de caducidades por lote:
              lo que caduca primero, sale primero.
            </Funcion>
            <Funcion icon={Hammer} titulo="Ferreterías" delay={0}>
              Productos con variantes de medida o tamaño, y venta suelta por
              kilo o metro para tornillería y material.
            </Funcion>
            <Funcion icon={PencilRuler} titulo="Papelerías" delay={80}>
              Categorías precargadas y solo las funciones que usas — sin
              pantallas de más que nada más estorban.
            </Funcion>
            <Funcion icon={SlidersHorizontal} titulo="¿Otro giro?" delay={160}>
              Las funciones se prenden y se apagan según lo que necesites:
              caducidades, granel, tallas, apartados, reparto. Tu sistema, a tu
              modo.
            </Funcion>
          </div>
        </div>
      </section>

      {/* ─── PRECIOS ─── */}
      <section id="precios" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="text-center">
            <p className="eyebrow mb-3 text-primary">Precios</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Precios claros, sin sorpresas
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Pagas una vez por el sistema y es tuyo. Solo el rastreo lleva un
              mantenimiento mensual por repartidor.
            </p>
          </Reveal>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 lg:grid-cols-3">
            {/* POS */}
            <Reveal delay={0} className="h-full">
              <div className="card-soft flex h-full flex-col p-7">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Store className="h-5.5 w-5.5" />
                </div>
                <h3 className="text-lg font-bold">Punto de venta</h3>
                <p className="mt-3">
                  <span className="text-4xl font-bold tracking-tight">$15,000</span>
                  <span className="ml-1.5 text-sm text-muted-foreground">MXN · pago único</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted-foreground">
                  {[
                    'Ventas con pantalla táctil y código de barras',
                    'Inventario, caducidades y compras',
                    'Clientes, fiados y listas de precio',
                    'Corte de caja y turnos',
                    'Finanzas y reportes en Excel',
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* Rastreador */}
            <Reveal delay={120} className="h-full">
              <div className="card-soft relative flex h-full flex-col p-7 ring-2 ring-primary">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-md">
                  Para negocios con reparto
                </span>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Truck className="h-5.5 w-5.5" />
                </div>
                <h3 className="text-lg font-bold">Rastreador de flotilla</h3>
                <p className="mt-3">
                  <span className="text-4xl font-bold tracking-tight">$30,000</span>
                  <span className="ml-1.5 text-sm text-muted-foreground">MXN · pago único</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted-foreground">
                  {[
                    'Mapa en tiempo real de todos tus repartidores',
                    'Rutas que siguen las calles de verdad',
                    'Bitácora de paradas con hora y lugar',
                    'Entrega de carga con confirmación',
                    'Alertas y avisos directos a tu gente',
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* Mantenimiento */}
            <Reveal delay={240} className="h-full">
              <div className="card-soft flex h-full flex-col p-7">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-5.5 w-5.5" />
                </div>
                <h3 className="text-lg font-bold">Mantenimiento del rastreo</h3>
                <p className="mt-3">
                  <span className="text-4xl font-bold tracking-tight">$100</span>
                  <span className="ml-1.5 text-sm text-muted-foreground">MXN · por repartidor al mes</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted-foreground">
                  {[
                    'Servidores y mapas funcionando 24/7',
                    'Respaldo de tu información',
                    'Actualizaciones del sistema',
                    'Soporte directo con nosotros',
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── CONTACTO ─── */}
      <section id="contacto" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground shadow-[0_20px_60px_-20px_rgb(0_0_0/0.5)] sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-black/10 blur-3xl" />
            <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
              ¿Listo para poner orden en tu negocio?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg opacity-90">
              Escríbenos y te enseñamos el sistema funcionando, sin compromiso.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-primary shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </a>
              <a
                href={TELEFONO_TEL}
                className="flex items-center gap-2 rounded-xl border border-white/40 px-6 py-3.5 font-semibold transition-all hover:-translate-y-0.5 hover:bg-white/10"
              >
                <Phone className="h-5 w-5" />
                {TELEFONO_DISPLAY}
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            POS Tiendita · Hecho en México 🇲🇽
          </p>
          <p>
            Contacto:{' '}
            <a href={TELEFONO_TEL} className="font-medium text-foreground hover:text-primary">
              {TELEFONO_DISPLAY}
            </a>
          </p>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Entrar al sistema
          </Link>
        </div>
      </footer>
    </div>
  )
}
