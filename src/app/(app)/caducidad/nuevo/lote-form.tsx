'use client'

import { useActionState, useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { calcularFechaCaducidad } from '@/lib/caducidad'
import type { LoteState } from '../actions'

type Producto = {
  id: string
  nombre: string
  tipo_caducidad: 'envasado' | 'fresco' | null
}

type Categoria = {
  id: string
  nombre: string
  dias_refri: number | null
  dias_congelador: number | null
  dias_ambiente: number | null
}

type Props = {
  action: (prev: LoteState, formData: FormData) => Promise<LoteState>
  productos: Producto[]
  categorias: Categoria[]
  hoy: string
}

export default function LoteForm({ action, productos, categorias, hoy }: Props) {
  const [state, formAction, pending] = useActionState(action, null)

  const [productoId, setProductoId] = useState('')
  const [tipo, setTipo] = useState<'envasado' | 'fresco' | null>(null)
  const [ubicacion, setUbicacion] = useState('ambiente')
  const [categoriaId, setCategoriaId] = useState('')
  const [fechaRecepcion, setFechaRecepcion] = useState(hoy)
  const [fechaCaducidadCalc, setFechaCaducidadCalc] = useState('')
  const [fechaCaducidadManual, setFechaCaducidadManual] = useState('')

  // Actualizar tipo al cambiar producto
  useEffect(() => {
    const prod = productos.find((p) => p.id === productoId)
    setTipo(prod?.tipo_caducidad ?? null)
    setCategoriaId('')
    setFechaCaducidadCalc('')
  }, [productoId, productos])

  // Recalcular fecha cuando cambia categoría, ubicación o recepción (solo para frescos)
  useEffect(() => {
    if (tipo !== 'fresco' || !categoriaId || !fechaRecepcion) {
      setFechaCaducidadCalc('')
      return
    }
    const cat = categorias.find((c) => c.id === categoriaId)
    if (!cat) return
    const dias =
      ubicacion === 'refri'      ? cat.dias_refri :
      ubicacion === 'congelador' ? cat.dias_congelador :
                                   cat.dias_ambiente
    if (!dias) {
      setFechaCaducidadCalc('')
    } else {
      setFechaCaducidadCalc(calcularFechaCaducidad(fechaRecepcion, dias))
    }
  }, [tipo, categoriaId, ubicacion, fechaRecepcion, categorias])

  // La fecha de caducidad que se envía al servidor
  const fechaCaducidadFinal =
    tipo === 'fresco' ? (fechaCaducidadManual || fechaCaducidadCalc) : fechaCaducidadManual

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Registrar lote</h1>

      <form action={formAction} className="flex flex-col gap-5">
        {/* Producto */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            Producto <span className="text-destructive">*</span>
          </label>
          <select
            name="producto_id"
            required
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Selecciona un producto…</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.tipo_caducidad === 'fresco' ? ' (fresco)' : p.tipo_caducidad === 'envasado' ? ' (envasado)' : ''}
              </option>
            ))}
          </select>
          {tipo === null && productoId && (
            <p className="text-xs text-muted-foreground">
              Este producto no tiene tipo de caducidad asignado. Se tratará como envasado.
            </p>
          )}
        </div>

        {/* Tipo de lote — visible solo si el producto no tiene tipo definido */}
        {/* (se muestra automáticamente el tipo del producto cuando existe) */}
        {tipo && (
          <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            tipo === 'fresco'
              ? 'border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300'
              : 'border-gray-200 bg-muted text-muted-foreground'
          }`}>
            {tipo === 'fresco'
              ? '📦 Producto fresco — la fecha se calcula desde recepción + días de vida útil'
              : '🏷️ Producto envasado — ingresa la fecha impresa en el empaque'}
          </div>
        )}

        {/* Cantidad */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            Cantidad <span className="text-destructive">*</span>
          </label>
          <input
            name="cantidad"
            type="number"
            min="1"
            defaultValue="1"
            required
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Fecha de recepción */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Fecha de recepción</label>
          <input
            name="fecha_recepcion"
            type="date"
            value={fechaRecepcion}
            onChange={(e) => setFechaRecepcion(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Ubicación */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Ubicación</label>
          <select
            name="ubicacion"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ambiente">Temperatura ambiente</option>
            <option value="refri">Refrigerador</option>
            <option value="congelador">Congelador</option>
          </select>
        </div>

        {/* Categoría perecedero — solo para frescos */}
        {tipo === 'fresco' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Categoría de perecedero</label>
            {categorias.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay categorías configuradas.{' '}
                <Link href="/caducidad/configuracion" className="text-primary hover:underline">
                  Configura las categorías
                </Link>{' '}
                primero.
              </p>
            ) : (
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecciona para calcular automáticamente…</option>
                {categorias.map((c) => {
                  const dias =
                    ubicacion === 'refri'      ? c.dias_refri :
                    ubicacion === 'congelador' ? c.dias_congelador :
                                                 c.dias_ambiente
                  return (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {dias ? ` (${dias} días en ${ubicacion === 'refri' ? 'refri' : ubicacion === 'congelador' ? 'congelador' : 'ambiente'})` : ' (sin dato para esta ubicación)'}
                    </option>
                  )
                })}
              </select>
            )}
            {fechaCaducidadCalc && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ✓ Fecha calculada: <strong>{fechaCaducidadCalc}</strong>
              </p>
            )}
          </div>
        )}

        {/* Fecha de caducidad */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            Fecha de caducidad <span className="text-destructive">*</span>
          </label>
          {tipo === 'fresco' && fechaCaducidadCalc ? (
            <>
              <input type="hidden" name="fecha_caducidad" value={fechaCaducidadManual || fechaCaducidadCalc} />
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={fechaCaducidadManual || fechaCaducidadCalc}
                  onChange={(e) => setFechaCaducidadManual(e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
                />
                {fechaCaducidadManual && fechaCaducidadManual !== fechaCaducidadCalc && (
                  <button
                    type="button"
                    onClick={() => setFechaCaducidadManual('')}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Restablecer
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Calculada automáticamente. Puedes ajustarla según tu congelador o condiciones reales.
              </p>
            </>
          ) : (
            <>
              <input
                name="fecha_caducidad"
                type="date"
                required
                value={fechaCaducidadManual}
                onChange={(e) => setFechaCaducidadManual(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
              />
              {tipo === 'envasado' && (
                <p className="text-xs text-muted-foreground">
                  Ingresa la fecha impresa en el empaque del producto.
                </p>
              )}
            </>
          )}
        </div>

        {/* Notas */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Notas (opcional)</label>
          <input
            name="notas"
            placeholder="Ej: Lote de proveedor Ramírez, número de lote 42"
            className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={pending || !fechaCaducidadFinal}
            className="flex-1 py-3 text-base"
          >
            {pending ? 'Guardando…' : 'Registrar lote'}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/caducidad">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
