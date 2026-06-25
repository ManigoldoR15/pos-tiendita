'use client'

import { useTransition, useState, useActionState, useEffect } from 'react'
import { Pencil, MapPin, Check, X } from 'lucide-react'
import { toggleActivoPlazaAction, editarPlazaAction } from './actions'

const COLORES = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

type Plaza = {
  id: string
  nombre: string
  direccion: string | null
  color: string
  activo: boolean
  es_principal: boolean
}

export default function PlazaCard({ plaza }: { plaza: Plaza }) {
  const [editing, setEditing] = useState(false)
  const [colorEdit, setColorEdit] = useState(plaza.color)
  const [toggling, startToggle] = useTransition()
  const [editState, editAction, editPending] = useActionState(editarPlazaAction, null)

  useEffect(() => {
    if (editState?.ok) setEditing(false)
  }, [editState])

  function handleToggle() {
    if (!confirm(plaza.activo ? `¿Desactivar "${plaza.nombre}"?` : `¿Activar "${plaza.nombre}"?`)) return
    startToggle(async () => { await toggleActivoPlazaAction(plaza.id, !plaza.activo) })
  }

  return (
    <div className={`rounded-xl border p-4 transition-opacity ${!plaza.activo ? 'opacity-50' : ''}`}>
      {!editing ? (
        <div className="flex items-start gap-3">
          <div className="h-4 w-4 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: plaza.color }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">{plaza.nombre}</p>
              {plaza.es_principal && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                  Principal
                </span>
              )}
              {!plaza.activo && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                  Inactiva
                </span>
              )}
            </div>
            {plaza.direccion && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />{plaza.direccion}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {!plaza.es_principal && (
              <button
                onClick={handleToggle}
                disabled={toggling}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                  plaza.activo
                    ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                }`}
              >
                {toggling ? '…' : plaza.activo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <form action={editAction} className="space-y-3">
          <input type="hidden" name="local_id" value={plaza.id} />
          <input type="hidden" name="color" value={colorEdit} />

          <div className="flex gap-2 items-center">
            <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: colorEdit }} />
            <input
              name="nombre"
              defaultValue={plaza.nombre}
              required
              className="flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <input
            name="direccion"
            defaultValue={plaza.direccion ?? ''}
            placeholder="Dirección (opcional)"
            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <div className="flex gap-1.5">
            {COLORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColorEdit(c)}
                className={`h-6 w-6 rounded-full transition-transform ${colorEdit === c ? 'scale-125 ring-2 ring-offset-1 ring-primary' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {editState?.error && <p className="text-xs text-destructive">{editState.error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={editPending}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              <Check className="h-3.5 w-3.5" />{editPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => { setEditing(false); setColorEdit(plaza.color) }}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
