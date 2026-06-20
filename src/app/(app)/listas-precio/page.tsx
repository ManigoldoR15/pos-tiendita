import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Tag, ChevronRight, ToggleLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { cn } from '@/lib/utils'
import { toggleListaAction } from '@/app/actions/listas-precio'
import CrearListaForm from './crear-lista-form'
import EliminarListaButton from './eliminar-lista-button'

export default async function ListasPrecioPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol === 'empleado') redirect('/')

  const supabase = await createClient()
  const { data: listas } = await supabase
    .from('listas_precio')
    .select('id, nombre, descripcion, activo, created_at')
    .eq('negocio_id', negocio.id)
    .order('created_at')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Listas de precios</h1>
        <p className="text-sm text-muted-foreground">
          Crea precios especiales para mayoreo, VIP, distribuidores, etc. Se aplican en el POS al momento de cobrar.
        </p>
      </div>

      {/* Lista existentes */}
      {(listas ?? []).length > 0 && (
        <div className="space-y-2">
          {(listas ?? []).map((lista) => (
            <div key={lista.id} className="card-soft flex items-center gap-4 p-4">
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                lista.activo ? 'bg-primary/10' : 'bg-muted',
              )}>
                <Tag className={cn('h-5 w-5', lista.activo ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn('font-semibold', !lista.activo && 'text-muted-foreground')}>
                    {lista.nombre}
                  </p>
                  {!lista.activo && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      inactiva
                    </span>
                  )}
                </div>
                {lista.descripcion && (
                  <p className="truncate text-xs text-muted-foreground">{lista.descripcion}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <form action={toggleListaAction.bind(null, lista.id)}>
                  <button
                    type="submit"
                    title={lista.activo ? 'Desactivar' : 'Activar'}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <ToggleLeft className="h-4 w-4" />
                  </button>
                </form>
                <EliminarListaButton listaId={lista.id} nombre={lista.nombre} />
                <Link
                  href={`/listas-precio/${lista.id}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Crear nueva lista */}
      <div className="card-soft p-5">
        <h2 className="eyebrow mb-1.5 text-[10px] sm:text-xs">Crear lista de precios</h2>
        <CrearListaForm />
      </div>
    </div>
  )
}
