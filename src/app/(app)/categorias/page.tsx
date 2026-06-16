import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { Button } from '@/components/ui/button'
import { getColorCategoria } from '@/lib/colores-categoria'
import { cn } from '@/lib/utils'
import FormNuevaCategoria from './form-nueva-categoria'
import { eliminarCategoriaAction } from './actions'

export default async function CategoriasPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')
  const supabase = await createClient()

  const { data: categorias } = await supabase
    .from('categorias_producto')
    .select('id, nombre, color, productos(count)')
    .eq('negocio_id', negocio!.id)
    .order('nombre')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Categorías</h1>

      <FormNuevaCategoria />

      {categorias && categorias.length > 0 ? (
        <ul className="mt-6 divide-y rounded-xl border">
          {categorias.map((cat) => {
            const total = (cat.productos as unknown as { count: number }[])?.[0]
              ?.count ?? 0
            const colorCat = getColorCategoria(cat.color)
            return (
              <li key={cat.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'h-3 w-3 shrink-0 rounded-full',
                      colorCat ? colorCat.dot : 'bg-muted',
                    )}
                  />
                  <div>
                    <p className="font-medium">{cat.nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      {total} producto{total !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/categorias/${cat.id}/editar`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <form action={eliminarCategoriaAction}>
                    <input type="hidden" name="id" value={cat.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      Eliminar
                    </Button>
                  </form>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-6 text-center text-muted-foreground">
          No tienes categorías. ¡Agrega la primera!
        </p>
      )}
    </div>
  )
}
