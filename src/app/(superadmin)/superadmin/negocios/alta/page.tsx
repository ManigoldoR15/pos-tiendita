'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Eye, EyeOff, Store, Truck, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { crearClienteAction } from './actions'
import { TIPOS_NEGOCIO } from '@/lib/tipos-negocio'

const inputCls = 'w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500'
const selectCls = 'w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500'
const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'
const sectionTitleCls = 'text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4'

function PaqueteSwitch({
  name, checked, onChange, Icon, titulo, precio, desc,
}: {
  name: string
  checked: boolean
  onChange: (v: boolean) => void
  Icon: React.FC<{ className?: string }>
  titulo: string
  precio: string
  desc: string
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 cursor-pointer rounded-xl border p-4 transition-colors',
        checked
          ? 'border-violet-500/60 bg-violet-950/30'
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600',
      )}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          checked ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-400',
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-slate-100">{titulo}</span>
          {/* Switch visual */}
          <span
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
              checked ? 'bg-violet-500' : 'bg-slate-600',
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                checked ? 'translate-x-[18px]' : 'translate-x-0.5',
              )}
            />
          </span>
        </span>
        <span className="block text-xs font-semibold text-violet-300 mt-0.5">{precio}</span>
        <span className="block text-[11px] text-slate-500 mt-1">{desc}</span>
      </span>
    </label>
  )
}

export default function NuevoClientePage() {
  const [state, action, pending] = useActionState(crearClienteAction, null)
  const [modoAcceso, setModoAcceso] = useState<'invitacion' | 'password'>('invitacion')
  const [verPassword, setVerPassword] = useState(false)
  const [paqPos, setPaqPos] = useState(true)
  const [paqRastreador, setPaqRastreador] = useState(false)

  return (
    <div className="max-w-lg space-y-6">
      {/* Back */}
      <Link
        href="/superadmin/negocios"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Nuevo cliente</h1>
        <p className="mt-1 text-sm text-slate-400">
          Alta completa: datos del negocio, acceso del dueño y paquetes comprados.
        </p>
      </div>

      {/* Formulario */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6">
        <form action={action} className="space-y-6">

          {/* Negocio */}
          <div className="space-y-4">
            <p className={sectionTitleCls}>Negocio</p>
            <div>
              <label className={labelCls}>Nombre del negocio *</label>
              <input
                name="nombre"
                required
                placeholder="Tiendita La Esperanza"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Giro del negocio *</label>
              <select name="tipo_negocio" defaultValue="tiendita" className={selectCls}>
                {Object.entries(TIPOS_NEGOCIO).map(([slug, t]) => (
                  <option key={slug} value={slug}>{t.emoji} {t.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Preconfigura el sistema: ropa activa tallas/colores y oculta caducidades;
                los giros de comida quedan como siempre.
              </p>
            </div>
            <div>
              <label className={labelCls}>Ubicación</label>
              <input
                name="ubicacion"
                placeholder="Colonia, Ciudad, Estado"
                className={inputCls}
              />
            </div>
          </div>

          {/* Dueño */}
          <div className="space-y-4">
            <p className={sectionTitleCls}>Dueño</p>
            <div>
              <label className={labelCls}>Nombre completo *</label>
              <input
                name="nombre_dueno"
                required
                placeholder="Juan García"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Correo electrónico *</label>
              <input
                name="email_dueno"
                type="email"
                required
                placeholder="juan@ejemplo.com"
                className={inputCls}
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                Si ya existe una cuenta con este correo, se reutiliza.
              </p>
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input
                name="telefono_dueno"
                type="tel"
                placeholder="614 123 4567"
                className={inputCls}
              />
            </div>
          </div>

          {/* Acceso del dueño */}
          <div className="space-y-3">
            <p className={sectionTitleCls}>Acceso del dueño</p>
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-700 bg-slate-800/50 p-3">
              <input
                type="radio"
                name="modo_acceso"
                value="invitacion"
                checked={modoAcceso === 'invitacion'}
                onChange={() => setModoAcceso('invitacion')}
                className="mt-0.5 accent-violet-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-200">Enviar invitación por correo</span>
                <span className="block text-[11px] text-slate-500">El dueño recibe un email y elige su propia contraseña.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-700 bg-slate-800/50 p-3">
              <input
                type="radio"
                name="modo_acceso"
                value="password"
                checked={modoAcceso === 'password'}
                onChange={() => setModoAcceso('password')}
                className="mt-0.5 accent-violet-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-200">Asignar contraseña ahora</span>
                <span className="block text-[11px] text-slate-500">Para altas en persona: entra de inmediato con la contraseña que le des.</span>
              </span>
            </label>
            {modoAcceso === 'password' && (
              <div>
                <label className={labelCls}>Contraseña temporal *</label>
                <div className="relative">
                  <input
                    type={verPassword ? 'text' : 'password'}
                    name="password"
                    minLength={6}
                    required
                    placeholder="Mínimo 6 caracteres"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Paquetes comprados — pago único, no suscripción */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className={sectionTitleCls}>Paquetes comprados</p>
              {paqPos && paqRastreador && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-900/50 border border-emerald-700/50 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wide mb-4">
                  <Check className="h-3 w-3" /> Paquete completo
                </span>
              )}
            </div>
            <PaqueteSwitch
              name="paq_pos"
              checked={paqPos}
              onChange={setPaqPos}
              Icon={Store}
              titulo="POS completo"
              precio="$15,000 MXN · pago único"
              desc="Punto de venta, inventario, fiados, corte de caja, finanzas y reportes."
            />
            <PaqueteSwitch
              name="paq_rastreador"
              checked={paqRastreador}
              onChange={setPaqRastreador}
              Icon={Truck}
              titulo="Rastreador de flotilla"
              precio="$30,000 MXN · pago único + $100/repartidor al mes"
              desc="Mapa en vivo de repartidores, bitácora de paradas y entregas con confirmación. Si no lo compra, la sección de reparto no le aparece."
            />
            {!paqPos && !paqRastreador && (
              <p className="text-[11px] text-amber-400">Elige al menos un paquete.</p>
            )}
          </div>

          {/* Error */}
          {state?.error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-950/30 border border-red-700/40 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{state.error}</p>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={pending || (!paqPos && !paqRastreador)}
              className="flex-1 h-10 rounded-lg bg-violet-600 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60 transition-colors"
            >
              {pending ? 'Creando…' : modoAcceso === 'invitacion' ? 'Crear cliente y enviar invitación' : 'Crear cliente con contraseña'}
            </button>
            <Link
              href="/superadmin/negocios"
              className="h-10 flex items-center rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
