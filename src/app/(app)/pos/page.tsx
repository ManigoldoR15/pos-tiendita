import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import PosClient from './pos-client'

export default async function PosPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const [{ data: productos }, { data: categorias }, { data: metodosPago }] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, precio_venta, existencias, categoria_id')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('categorias_producto')
      .select('id, nombre')
      .eq('negocio_id', negocio.id)
      .order('nombre'),
    supabase
      .from('metodos_pago')
      .select('id, nombre')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
  ])

  return (
    <PosClient
      productos={productos ?? []}
      categorias={categorias ?? []}
      metodosPago={metodosPago ?? []}
    />
  )
}
