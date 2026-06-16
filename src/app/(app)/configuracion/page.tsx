import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { hoyMX } from '@/lib/fecha'
import FormNombre from './form-nombre'
import FormMetodoPago from './form-metodo-pago'
import FormEmpleado from './form-empleado'
import FormMeta from './form-meta'
import { toggleMetodoPagoAction, eliminarMetodoPagoAction } from './actions'
import { eliminarEmpleadoAction } from './actions-empleados'
import SelectorRolEmpleado from './selector-rol-empleado'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

export default async function ConfiguracionPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const rolActual = await getRolActual()
  if (rolActual !== 'dueno') redirect('/')

  const { data: metodos } = await supabase
    .from('metodos_pago')
    .select('id, nombre, activo')
    .eq('negocio_id', negocio.id)
    .order('nombre')

  type Miembro = { user_id: string; email: string; rol: string; created_at: string }
  let miembros: Miembro[] = []
  let metaActual: number | null = null

  if (rolActual === 'dueno') {
    const hoy = hoyMX()
    const mes = hoy.substring(0, 8) + '01'
    const [{ data: miembrosData }, { data: metaData }] = await Promise.all([
      supabase.rpc('get_miembros_negocio', { p_negocio_id: negocio.id }),
      supabase
        .from('metas')
        .select('meta_ventas')
        .eq('negocio_id', negocio.id)
        .eq('mes', mes)
        .single(),
    ])
    miembros = (miembrosData as Miembro[]) ?? []
    metaActual = metaData?.meta_ventas ?? null
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="text-2xl font-bold">Configuración</h1>


      {/* — Negocio ———————————————————————— */}
      <section className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-base">Negocio</h2>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Nombre del negocio</label>
          <FormNombre nombreActual={negocio.nombre} />
        </div>
      </section>

      {/* — Métodos de pago ——————————————————— */}
      <section className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-base">Métodos de pago</h2>

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
        <section className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <div>
            <h2 className="font-semibold text-base">Meta de ventas del mes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Establece tu objetivo mensual para ver el avance en el dashboard.
            </p>
          </div>
          <FormMeta metaActual={metaActual} />
        </section>
      )}

      {/* — Empleados (solo dueño) ——————————————— */}
      {rolActual === 'dueno' && (
        <section className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-base">Equipo</h2>

          <ul className="divide-y -mx-5">
            {miembros.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.email}</p>
                </div>

                {m.rol === 'dueno' ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    Dueño
                  </span>
                ) : (
                  <>
                    <SelectorRolEmpleado userId={m.user_id} rolActual={m.rol} />

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
              </li>
            ))}
          </ul>

          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Agregar empleado</p>
            <FormEmpleado />
          </div>
        </section>
      )}
    </div>
  )
}
