import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import ImportarProductosClient from './importar-client'

export default async function ImportarProductosPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const { data: plazas } = await supabase
    .from('locales')
    .select('id, nombre')
    .eq('negocio_id', negocio.id)
    .eq('activo', true)
    .order('nombre')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Importar productos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube un archivo CSV o Excel. Revisa la previsualización antes de confirmar.
        </p>
      </div>

      <ImportarProductosClient plazas={plazas ?? []} />
    </div>
  )
}
