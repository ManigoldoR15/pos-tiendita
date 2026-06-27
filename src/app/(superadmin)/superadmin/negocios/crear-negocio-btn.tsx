'use client'

import { useActionState, useState } from 'react'
import { Plus, X, Eye, EyeOff } from 'lucide-react'
import { crearNegocioSuperadminAction } from './[id]/actions'

type State = { error?: string; ok?: boolean } | null

export default function CrearNegocioBtn() {
  const [open, setOpen] = useState(false)
  const [verPassword, setVerPassword] = useState(false)
  const [state, action, pending] = useActionState<State, FormData>(
    crearNegocioSuperadminAction,
    null,
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-2 text-sm font-semibold text-white"
      >
        <Plus className="h-4 w-4" />
        Nuevo negocio
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white">Crear negocio</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form action={action} className="space-y-4">
              {state?.error && (
                <p className="rounded-lg bg-red-900/40 border border-red-700/40 px-3 py-2 text-sm text-red-300">
                  {state.error}
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Nombre del negocio
                </label>
                <input
                  type="text"
                  name="nombre"
                  required
                  placeholder="Tiendita Pérez"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Correo del dueño
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="dueno@ejemplo.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Si ya tiene cuenta, se agrega al negocio. Si no, se crea una cuenta nueva.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Contraseña temporal
                </label>
                <div className="relative">
                  <input
                    type={verPassword ? 'text' : 'password'}
                    name="password"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Solo se usa si se crea cuenta nueva.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 py-2.5 text-sm font-bold text-white transition-colors"
                >
                  {pending ? 'Creando…' : 'Crear negocio'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 rounded-xl border border-slate-700 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
