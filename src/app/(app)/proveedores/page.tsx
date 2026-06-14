import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import FormProveedor from './form-proveedor'
import ProveedorCard from './proveedor-card'
import { crearProveedorAction } from './actions'

export default async function ProveedoresPage() {
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()
  if (!rol || rol === 'empleado') redirect('/')

  const supabase = await createClient()
  const { data: proveedores } = await supabase
    .from('proveedores')
    .select('id, nombre, telefono, email, notas')
    .eq('negocio_id', negocio.id)
    .eq('activo', true)
    .order('nombre')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Proveedores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contactos de quienes surtes tu negocio.
        </p>
      </div>

      {/* Formulario nuevo proveedor */}
      <div className="mb-8 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-sm">Nuevo proveedor</h2>
        <FormProveedor action={crearProveedorAction} />
      </div>

      {/* Lista */}
      {!proveedores || proveedores.length === 0 ? (
        <div className="mt-6 text-center text-muted-foreground">
          <p className="text-lg">No tienes proveedores registrados aún.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {proveedores.map((p) => (
            <ProveedorCard key={p.id} proveedor={p} />
          ))}
        </div>
      )}
    </div>
  )
}
