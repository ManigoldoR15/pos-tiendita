'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { crearAnuncioAction } from './actions'

export default function NuevoAnuncioForm() {
  const [isPending, startTransition] = useTransition()
  const [ok, setOk] = useState(false)

  function submit(fd: FormData) {
    startTransition(async () => {
      await crearAnuncioAction(fd)
      setOk(true)
      setTimeout(() => setOk(false), 3000)
    })
  }

  return (
    <form action={submit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          name="titulo"
          required
          placeholder="Título del anuncio"
          className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-slate-500"
        />
        <select
          name="tipo"
          className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
        >
          <option value="info">ℹ️ Info</option>
          <option value="aviso">⚠️ Aviso</option>
          <option value="critico">🚨 Crítico</option>
        </select>
      </div>
      <textarea
        name="mensaje"
        required
        rows={2}
        placeholder="Mensaje visible para todos los negocios…"
        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-slate-500 resize-none"
      />
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Expira (opcional)</label>
          <input
            name="expira_en"
            type="datetime-local"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {ok ? '✓ Enviado' : 'Publicar'}
        </button>
      </div>
    </form>
  )
}
