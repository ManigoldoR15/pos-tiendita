'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Pencil, X, Check, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMXN } from '@/lib/dinero'
import { cn } from '@/lib/utils'
import {
  upsertPrecioEspecialAction,
  eliminarPrecioEspecialAction,
  type PrecioEspecial,
} from './actions-precios'
import { calcPrecioFinal } from '@/lib/precios-especiales'

type Producto = { id: string; nombre: string; precio_venta: number; precio_costo: number | null }

type Props = {
  clienteId: string
  clienteNombre: string
  precios: PrecioEspecial[]
  productos: Producto[]
  esDueno: boolean
}

function formatDescuento(tipo: 'porcentaje' | 'monto_fijo', valor: number) {
  if (tipo === 'porcentaje') return `${(valor / 100).toFixed(2).replace(/\.00$/, '')}%`
  return `−${formatMXN(valor)}`
}

export default function PreciosEspecialesManager({ clienteId, clienteNombre, precios, productos, esDueno }: Props) {
  const [pending, startTransition] = useTransition()
  const [editando, setEditando] = useState<string | null>(null) // id o 'nuevo'
  const [productoId, setProductoId] = useState('')
  const [tipo, setTipo] = useState<'porcentaje' | 'monto_fijo'>('porcentaje')
  const [valorTexto, setValorTexto] = useState('')
  const [error, setError] = useState<string | null>(null)

  const productosEnUso = new Set(precios.map((p) => p.producto_id))

  function abrirNuevo() {
    setEditando('nuevo')
    setProductoId('')
    setTipo('porcentaje')
    setValorTexto('')
    setError(null)
  }

  function abrirEditar(p: PrecioEspecial) {
    setEditando(p.id)
    setProductoId(p.producto_id)
    setTipo(p.tipo)
    setValorTexto(tipo === 'porcentaje' ? (p.valor / 100).toString() : (p.valor / 100).toString())
    // Re-compute display value
    const display = p.tipo === 'porcentaje'
      ? (p.valor / 100).toFixed(2).replace(/\.00$/, '')
      : (p.valor / 100).toFixed(2)
    setValorTexto(display)
    setError(null)
  }

  function cancelar() {
    setEditando(null)
    setError(null)
  }

  function valorAEntero(t: 'porcentaje' | 'monto_fijo', txt: string): number | null {
    const n = parseFloat(txt.replace(',', '.'))
    if (isNaN(n) || n <= 0) return null
    if (t === 'porcentaje') {
      if (n <= 0 || n >= 100) return null
      return Math.round(n * 100) // basis points
    }
    return Math.round(n * 100) // centavos
  }

  function guardar() {
    setError(null)
    if (!productoId) { setError('Elige un producto'); return }
    const v = valorAEntero(tipo, valorTexto)
    if (v === null) {
      setError(tipo === 'porcentaje' ? 'Porcentaje inválido (0.01 – 99.99)' : 'Monto inválido')
      return
    }
    startTransition(async () => {
      const res = await upsertPrecioEspecialAction(clienteId, productoId, tipo, v)
      if (res.error) { setError(res.error); return }
      setEditando(null)
    })
  }

  function eliminar(id: string) {
    startTransition(async () => {
      await eliminarPrecioEspecialAction(id, clienteId)
    })
  }

  function imprimirLista() {
    window.print()
  }

  const productoSeleccionado = productos.find((p) => p.id === productoId)
  const previewValor = valorAEntero(tipo, valorTexto)
  const previewFinal = productoSeleccionado && previewValor !== null
    ? calcPrecioFinal(productoSeleccionado.precio_venta, tipo, previewValor)
    : null

  return (
    <>
    <style>{`
      @media print {
        .pec-no-print { display: none !important; }
        #lista-precios-print { display: block !important; }
      }
    `}</style>
    <div className="pec-no-print space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Precios especiales</h2>
        <div className="flex gap-2">
          {precios.length > 0 && (
            <Button variant="outline" size="sm" onClick={imprimirLista}>
              <Printer className="h-3.5 w-3.5 mr-1" />
              Imprimir lista
            </Button>
          )}
          {esDueno && (
            <Button size="sm" onClick={abrirNuevo} disabled={pending}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Agregar
            </Button>
          )}
        </div>
      </div>

      {/* Formulario nuevo/editar */}
      {editando !== null && esDueno && (
        <div className="card-soft p-4 space-y-3 border-2 border-primary/20">
          <p className="text-sm font-semibold">{editando === 'nuevo' ? 'Nuevo precio especial' : 'Editar precio'}</p>

          {/* Producto */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Producto</label>
            <select
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              disabled={editando !== 'nuevo'}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              <option value="">Elige un producto…</option>
              {productos
                .filter((p) => !productosEnUso.has(p.id) || p.id === productoId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({formatMXN(p.precio_venta)})
                  </option>
                ))}
            </select>
          </div>

          {/* Tipo de descuento */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo de descuento</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setTipo('porcentaje'); setValorTexto('') }}
                className={cn(
                  'flex-1 rounded-lg border py-2 text-sm font-medium transition-colors',
                  tipo === 'porcentaje' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent',
                )}
              >
                % Porcentaje
              </button>
              <button
                type="button"
                onClick={() => { setTipo('monto_fijo'); setValorTexto('') }}
                className={cn(
                  'flex-1 rounded-lg border py-2 text-sm font-medium transition-colors',
                  tipo === 'monto_fijo' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent',
                )}
              >
                $ Monto fijo
              </button>
            </div>
          </div>

          {/* Valor */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {tipo === 'porcentaje' ? 'Porcentaje de descuento (ej. 12.5)' : 'Pesos de descuento (ej. 10.00)'}
            </label>
            <div className="relative">
              {tipo === 'monto_fijo' && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              )}
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={tipo === 'porcentaje' ? '99.99' : undefined}
                placeholder={tipo === 'porcentaje' ? '12.50' : '10.00'}
                value={valorTexto}
                onChange={(e) => setValorTexto(e.target.value)}
                className={cn(
                  'w-full rounded-lg border bg-background py-2 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring',
                  tipo === 'monto_fijo' ? 'pl-7' : 'pl-3',
                )}
              />
              {tipo === 'porcentaje' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              )}
            </div>
          </div>

          {/* Preview */}
          {previewFinal !== null && productoSeleccionado && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio normal</span>
                <span className="line-through text-muted-foreground">{formatMXN(productoSeleccionado.precio_venta)}</span>
              </div>
              <div className="flex justify-between font-bold text-blue-700 dark:text-blue-400">
                <span>Precio especial</span>
                <span>{formatMXN(previewFinal)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>El cliente ahorra</span>
                <span>−{formatMXN(productoSeleccionado.precio_venta - previewFinal)}</span>
              </div>
              {productoSeleccionado.precio_costo !== null && (
                <div className={cn('flex justify-between', previewFinal >= productoSeleccionado.precio_costo ? 'text-muted-foreground' : 'text-destructive font-medium')}>
                  <span>Tú ganas por pieza</span>
                  <span>{formatMXN(previewFinal - productoSeleccionado.precio_costo)}</span>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={cancelar} disabled={pending}>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" className="flex-1" onClick={guardar} disabled={pending}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {pending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de precios especiales */}
      {precios.length === 0 && editando === null ? (
        <p className="text-sm text-muted-foreground">
          {esDueno ? 'Sin precios especiales. Usa "Agregar" para definir uno.' : 'Sin precios especiales configurados.'}
        </p>
      ) : (
        <div className="divide-y rounded-xl border overflow-hidden">
          {precios.map((p) => {
            const precioFinal = calcPrecioFinal(p.precio_venta, p.tipo, p.valor)
            const ahorro = p.precio_venta - precioFinal
            const margen = p.precio_costo !== null ? precioFinal - p.precio_costo : null
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-medium truncate">{p.producto_nombre}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="line-through">{formatMXN(p.precio_venta)}</span>
                    <span className="font-semibold text-foreground">{formatMXN(precioFinal)}</span>
                    <span className="text-blue-600 dark:text-blue-400">{formatDescuento(p.tipo, p.valor)}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">Ahorra {formatMXN(ahorro)}</span>
                    {margen !== null && (
                      <span className={margen >= 0 ? '' : 'text-destructive font-medium'}>
                        {margen >= 0 ? `Ganas ${formatMXN(margen)}/u` : `Pierdes ${formatMXN(Math.abs(margen))}/u`}
                      </span>
                    )}
                  </div>
                </div>
                {esDueno && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => abrirEditar(p)}
                      className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => eliminar(p.id)}
                      disabled={pending}
                      className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Contenido imprimible — oculto en pantalla, visible al imprimir */}
      <div id="lista-precios-print" style={{ display: 'none' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '12px', padding: '16px', maxWidth: '320px' }}>
          <h1 style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', marginBottom: '4px' }}>
            Lista de precios
          </h1>
          <p style={{ textAlign: 'center', marginBottom: '8px' }}>Para: {clienteNombre}</p>
          <p style={{ textAlign: 'center', marginBottom: '12px', fontSize: '10px' }}>
            {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <hr style={{ marginBottom: '8px' }} />
          {precios.map((p) => {
            const pf = calcPrecioFinal(p.precio_venta, p.tipo, p.valor)
            return (
              <div key={p.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dashed #ccc' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '2px' }}>{p.producto_nombre}</p>
                <p>Precio especial: ${(pf / 100).toFixed(2)} MXN</p>
                <p style={{ fontSize: '10px', color: '#666' }}>
                  ({formatDescuento(p.tipo, p.valor)} de descuento)
                </p>
              </div>
            )
          })}
          <hr style={{ marginTop: '8px' }} />
          <p style={{ fontSize: '10px', textAlign: 'center', marginTop: '8px' }}>
            Precios válidos hasta nuevo aviso
          </p>
        </div>
      </div>
    </div>
    </>
  )
}
