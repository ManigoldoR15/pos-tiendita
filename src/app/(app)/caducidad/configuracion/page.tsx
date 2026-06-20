import { redirect } from 'next/navigation'
import { Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { Button } from '@/components/ui/button'
import { crearCategoriaAction, eliminarCategoriaAction, seedCategoriasIfEmpty } from '../actions'
import CatForm from './cat-form'

export default async function CaducidadConfigPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol !== 'dueno' && rol !== 'administrador') redirect('/')

  await seedCategoriasIfEmpty(negocio.id)

  const supabase = await createClient()
  const { data: categorias } = await supabase
    .from('categorias_perecedero')
    .select('id, nombre, dias_refri, dias_congelador, dias_ambiente')
    .eq('negocio_id', negocio.id)
    .order('orden')
    .order('nombre')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/caducidad"
          className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Categorías de perecedero</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Días de vida útil por tipo de producto según almacenamiento.
            Valores base: FDA / FAO / AESAN — ajusta según tu equipo real.
          </p>
        </div>
      </div>

      {/* Tabla de categorías */}
      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-4 py-3 text-left">Categoría</th>
                <th className="px-4 py-3 text-center">Refri (días)</th>
                <th className="px-4 py-3 text-center">Congelador (días)</th>
                <th className="px-4 py-3 text-center">Ambiente (días)</th>
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {(categorias ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{c.nombre}</td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {c.dias_refri ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {c.dias_congelador ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {c.dias_ambiente ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <form action={eliminarCategoriaAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
              {(categorias ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No hay categorías. Agrega la primera abajo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulario para nueva categoría */}
      <div className="card-soft p-5">
        <h2 className="eyebrow mb-1.5 text-[10px] sm:text-xs">Agregar categoría</h2>
        <CatForm action={crearCategoriaAction} />
      </div>
    </div>
  )
}
