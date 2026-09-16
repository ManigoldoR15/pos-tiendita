'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { eliminarProductoAction, ocultarProductoAction, type EliminarProductoState } from './actions'

// Un solo estado para las dos acciones: el aviso que se ve es siempre el de
// la última, y si ocultar sale bien el aviso de "no se puede borrar" se quita.
function borrarUOcultar(prev: EliminarProductoState, formData: FormData) {
  return formData.get('accion') === 'ocultar'
    ? ocultarProductoAction(prev, formData)
    : eliminarProductoAction(prev, formData)
}

// Fila de acciones de la tarjeta de producto. Los demás botones llegan como
// children; el aviso de borrado se muestra debajo de la fila, a lo ancho.
export default function AccionesProducto({
  productoId,
  nombre,
  activo,
  children,
}: {
  productoId: string
  nombre: string
  activo: boolean
  children: React.ReactNode
}) {
  const [aviso, accion, ocupado] = useActionState(borrarUOcultar, null)

  return (
    <>
      <div className="flex gap-1">
        {children}
        <form action={accion} data-action="eliminar-producto">
          <input type="hidden" name="id" value={productoId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            title="Borrar producto"
            disabled={ocupado}
            className="text-destructive hover:text-destructive"
            onClick={(e) => {
              if (!confirm(`¿Borrar "${nombre}"? No se puede deshacer.`)) e.preventDefault()
            }}
          >
            {ocupado ? '…' : '✕'}
          </Button>
        </form>
      </div>

      {aviso && (
        <div role="alert" className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
          <p>{aviso.error}</p>
          {aviso.puedeOcultar && activo && (
            <form action={accion} className="mt-2">
              <input type="hidden" name="id" value={productoId} />
              <input type="hidden" name="accion" value="ocultar" />
              <Button type="submit" variant="outline" size="sm" disabled={ocupado} className="w-full">
                Ocultar producto
              </Button>
            </form>
          )}
          {aviso.puedeOcultar && !activo && (
            <p className="mt-1 font-medium">Este producto ya está oculto.</p>
          )}
        </div>
      )}
    </>
  )
}
