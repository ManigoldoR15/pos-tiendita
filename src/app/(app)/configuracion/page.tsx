import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { getModulos } from '@/lib/modulos'
import { hoyMX } from '@/lib/fecha'
import FormNombre from './form-nombre'
import FormMetodoPago from './form-metodo-pago'
import FormEmpleado from './form-empleado'
import FormMeta from './form-meta'
import FormPerfilNegocio from './form-perfil-negocio'
import { toggleMetodoPagoAction, eliminarMetodoPagoAction } from './actions'
import { eliminarEmpleadoAction } from './actions-empleados'
import SelectorRolEmpleado from './selector-rol-empleado'
import SelectorPlazaEmpleado from './selector-plaza-empleado'
import EditarDatosEmpleado from './editar-datos-empleado'
import BotonRespaldo from './boton-respaldo'
import { Button } from '@/components/ui/button'
import { Trash2, MapPin, ChevronRight, CreditCard } from 'lucide-react'
import { estadoSuscripcion, ETIQUETA_ESTADO } from '@/lib/suscripcion'

const SEXO_LABEL: Record<string, string> = { hombre: 'Hombre', mujer: 'Mujer', otro: 'Otro' }

function formatAntiguedad(desde: string): string {
  const inicio = new Date(desde)
  const dias = Math.floor((Date.now() - inicio.getTime()) / 86_400_000)
  if (dias < 1) return 'desde hoy'
  if (dias < 30) return `${dias} día${dias !== 1 ? 's' : ''}`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `${meses} mes${meses !== 1 ? 'es' : ''}`
  const anios = Math.floor(meses / 12)
  const mesesResto = meses % 12
  return mesesResto > 0
    ? `${anios} año${anios !== 1 ? 's' : ''} ${mesesResto} mes${mesesResto !== 1 ? 'es' : ''}`
    : `${anios} año${anios !== 1 ? 's' : ''}`
}

function fechaIngreso(desde: string): string {
  return new Date(desde).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function ConfiguracionPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const rolActual = await getRolActual()
  if (rolActual !== 'dueno') redirect('/')
  const modulos = await getModulos()

  const { data: metodos } = await supabase
    .from('metodos_pago')
    .select('id, nombre, activo')
    .eq('negocio_id', negocio.id)
    .order('nombre')

  type Miembro = { user_id: string; email: string; rol: string; created_at: string; local_id: string | null; local_nombre: string | null; nombre_completo: string | null; edad: number | null; sexo: string | null }
  type Local = { id: string; nombre: string; color: string; activo: boolean }
  let miembros: Miembro[] = []
  let metaActual: number | null = null
  let plazas: Local[] = []
  let maxPlazas = 1
  let plazasConStock: string[] = []

  if (rolActual === 'dueno') {
    const hoy = hoyMX()
    const mes = hoy.substring(0, 8) + '01'
    const [{ data: miembrosData }, { data: metaData }, { data: localesData }, { data: negocioExt }] = await Promise.all([
      supabase.rpc('get_miembros_negocio', { p_negocio_id: negocio.id }),
      supabase
        .from('metas')
        .select('meta_ventas')
        .eq('negocio_id', negocio.id)
        .eq('mes', mes)
        .single(),
      supabase
        .from('locales')
        .select('id, nombre, color, activo')
        .eq('negocio_id', negocio.id)
        .eq('activo', true)
        .order('created_at'),
      supabase
        .from('negocios')
        .select('max_plazas')
        .eq('id', negocio.id)
        .single(),
    ])
    miembros = (miembrosData as Miembro[]) ?? []
    metaActual = metaData?.meta_ventas ?? null
    plazas = (localesData as Local[]) ?? []
    maxPlazas = (negocioExt as { max_plazas: number } | null)?.max_plazas ?? 1

    // Qué plazas ya tienen mercancía: asignar a alguien a una plaza vacía lo
    // deja sin nada que vender, y eso se descubre hasta que hay un cliente
    // enfrente. Mejor avisarlo en el momento de asignar.
    if (plazas.length > 1) {
      const { data: lotes } = await supabase
        .from('lotes_producto')
        .select('local_id')
        .eq('negocio_id', negocio.id)
        .eq('activo', true)
        .gt('cantidad_actual', 0)
        .not('local_id', 'is', null)
      plazasConStock = [...new Set((lotes ?? []).map((l) => l.local_id as string))]
    }
  }

  const tieneMultiplasPlazas = plazas.length > 1 || maxPlazas > 1

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Configuración</h1>

      {/* — Suscripción ———————————————————————— */}
      <Link href="/suscripcion" className="card-soft flex items-center gap-3 p-5 transition-colors hover:bg-accent/50">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CreditCard className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Suscripción</p>
          <p className="text-xs text-muted-foreground">{ETIQUETA_ESTADO[estadoSuscripcion(negocio)].label}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      {/* — Negocio ———————————————————————— */}
      <section className="card-soft p-5 space-y-4">
        <h2 className="text-sm font-bold">Negocio</h2>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Nombre del negocio</label>
          <FormNombre nombreActual={negocio.nombre} />
        </div>
      </section>

      {/* — Perfil del negocio (solo dueño) ————————————————— */}
      {rolActual === 'dueno' && (
        <section className="card-soft p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold">Perfil del negocio</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nos ayuda a entender mejor el mercado y ofrecerte mejores herramientas.
            </p>
          </div>
          <FormPerfilNegocio
            tipoActual={(negocio as { tipo_negocio?: string }).tipo_negocio ?? 'tiendita'}
            ciudadActual={(negocio as { ciudad?: string | null }).ciudad ?? null}
            estadoActual={(negocio as { estado_mx?: string | null }).estado_mx ?? null}
            inscritoSat={(negocio as { inscrito_sat?: boolean }).inscrito_sat ?? false}
            rfcActual={negocio.rfc}
          />
        </section>
      )}

      {/* — Respaldo (solo dueño) ——————————————————————————— */}
      {rolActual === 'dueno' && <BotonRespaldo />}

      {/* — Plazas (solo dueño, solo si tiene más de 1 o puede tener más) ————— */}
      {rolActual === 'dueno' && tieneMultiplasPlazas && (
        <section className="card-soft p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold">Plazas</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {plazas.length} activa{plazas.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Link href="/configuracion/plazas" className="flex items-center gap-0.5 text-xs text-primary hover:underline">
              Administrar <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {plazas.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.nombre}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* — Métodos de pago ——————————————————— */}
      <section className="card-soft p-5 space-y-4">
        <h2 className="text-sm font-bold">Métodos de pago</h2>

        <ul className="divide-y -mx-5">
          {(metodos ?? []).map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex-1 text-sm font-medium">{m.nombre}</span>

              {/* toggle */}
              <form action={toggleMetodoPagoAction}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="activo" value={String(!m.activo)} />
                <button
                  type="submit"
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                    m.activo ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                  title={m.activo ? 'Desactivar' : 'Activar'}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                      m.activo ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </form>

              {/* eliminar */}
              <form action={eliminarMetodoPagoAction}>
                <input type="hidden" name="id" value={m.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </form>
            </li>
          ))}
        </ul>

        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">Agregar método de pago</p>
          <FormMetodoPago />
        </div>
      </section>

      {/* — Meta del mes (solo dueño) ——————————————— */}
      {rolActual === 'dueno' && (
        <section className="card-soft p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold">Meta de ventas del mes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Establece tu objetivo mensual para ver el avance en el dashboard.
            </p>
          </div>
          <FormMeta metaActual={metaActual} />
        </section>
      )}

      {/* — Empleados (solo dueño) ——————————————— */}
      {rolActual === 'dueno' && (
        <section className="card-soft p-5 space-y-4">
          <h2 className="text-sm font-bold">Equipo</h2>

          <ul className="divide-y -mx-5">
            {miembros.map((m) => {
              const detalles = [
                m.edad != null ? `${m.edad} años` : null,
                m.sexo ? SEXO_LABEL[m.sexo] : null,
              ].filter(Boolean)
              return (
              <li key={m.user_id} className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.nombre_completo || m.email}</p>
                    {m.nombre_completo && (
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    )}
                  </div>

                  {m.rol === 'dueno' ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      Dueño
                    </span>
                  ) : (
                    <>
                      {tieneMultiplasPlazas && m.rol !== 'repartidor' && (
                        <SelectorPlazaEmpleado
                          userId={m.user_id}
                          localIdActual={m.local_id}
                          plazas={plazas}
                          plazasConStock={plazasConStock}
                        />
                      )}
                      <SelectorRolEmpleado
                        userId={m.user_id}
                        rolActual={m.rol}
                        moduloReparto={modulos.repartidores}
                      />

                      <form action={eliminarEmpleadoAction}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Quitar del equipo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    </>
                  )}
                </div>

                {/* Historial / datos de la persona */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {detalles.length > 0 && <span>{detalles.join(' · ')}</span>}
                  <span title={`Ingresó el ${fechaIngreso(m.created_at)}`}>
                    Antigüedad: {formatAntiguedad(m.created_at)}
                  </span>
                </div>

                {m.rol !== 'dueno' && (
                  <div className="mt-2">
                    <EditarDatosEmpleado
                      userId={m.user_id}
                      nombre={m.nombre_completo}
                      edad={m.edad}
                      sexo={m.sexo}
                    />
                  </div>
                )}
              </li>
              )
            })}
          </ul>

          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Agregar al equipo</p>
            <FormEmpleado moduloReparto={modulos.repartidores} />
          </div>
        </section>
      )}
    </div>
  )
}
