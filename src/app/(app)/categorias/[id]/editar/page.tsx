import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FormEditarCategoria from './form'

export default async function EditarCategoriaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: categoria } = await supabase
    .from('categorias_producto')
    .select('id, nombre')
    .eq('id', id)
    .single()

  if (!categoria) notFound()

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Editar categoría</h1>
      <FormEditarCategoria id={categoria.id} nombreInicial={categoria.nombre} />
    </div>
  )
}
