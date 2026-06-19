import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { hoyMX } from '@/lib/fecha'
import CompraForm from './compra-form'

export default async function NuevaCompraPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (rol === 'empleado') redirect('/')

  const supabase = await createClient()
  const [{ data: productos }, { data: proveedores }] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, precio_costo, unidad_medida')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/compras"
          className="flex h-9 w-9 items-center justify-center rounded-xl border bg-card text-muted-foreground transition hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Registrar entrada</h1>
          <p className="text-sm text-muted-foreground">Nueva llegada de mercancía</p>
        </div>
      </div>

      <CompraForm
        productos={productos ?? []}
        proveedores={proveedores ?? []}
        hoy={hoyMX()}
      />
    </div>
  )
}
