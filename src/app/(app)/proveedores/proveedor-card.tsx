'use client'

import { useState } from 'react'
import { Mail, Phone, Pencil, Trash2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import FormProveedor from './form-proveedor'
import { actualizarProveedorAction, eliminarProveedorAction } from './actions'

type Proveedor = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  notas: string | null
}

export default function ProveedorCard({ proveedor }: { proveedor: Proveedor }) {
  const [editando, setEditando] = useState(false)

  if (editando) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <FormProveedor
          action={actualizarProveedorAction}
          proveedor={proveedor}
          onCancel={() => setEditando(false)}
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{proveedor.nombre}</p>

          {proveedor.telefono && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {proveedor.telefono}
            </p>
          )}
          {proveedor.email && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {proveedor.email}
            </p>
          )}
          {proveedor.notas && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{proveedor.notas}</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setEditando(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <form action={eliminarProveedorAction}>
            <input type="hidden" name="id" value={proveedor.id} />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
