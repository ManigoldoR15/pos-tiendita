import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import EtiquetasClient from './etiquetas-client'

export default async function EtiquetasPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const { data: productos } = await supabase
    .from('productos')
    .select('id, nombre, precio_venta, codigo_barras')
    .eq('negocio_id', negocio.id)
    .eq('activo', true)
    .order('nombre')
    .limit(500)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="print:hidden">
        <Link
          href="/productos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Productos
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Etiquetas de código de barras</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige productos y cuántas etiquetas quieres de cada uno. A los productos sin código
          se les genera uno automáticamente. Imprime en hoja tamaño carta y recorta.
        </p>
      </div>

      <EtiquetasClient
        productos={(productos ?? []) as {
          id: string; nombre: string; precio_venta: number; codigo_barras: string | null
        }[]}
      />
    </div>
  )
}
