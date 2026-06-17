'use client'

import { useState, useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { calcularFechaCaducidad } from '@/lib/caducidad'
import { stepCantidad, minCantidad } from '@/lib/unidades'

type Categoria = {
  id: string
  nombre: string
  dias_refri: number | null
  dias_congelador: number | null
  dias_ambiente: number | null
}

type Linea = {
  cantidad: string
  cantidad_bruta: string
  fecha_recepcion: string
  hora_recepcion: string
  ubicacion: 'ambiente' | 'refri' | 'congelador'
  categoria_id: string
  fecha_caducidad: string
  fecha_caducidad_manual: boolean
  notas: string
  notas_merma: string
}

type LoteJson = {
  cantidad: number
  cantidad_bruta: number | null
  fecha_recepcion: string
  hora_recepcion: string | null
  ubicacion: string
  fecha_caducidad: string | null
  notas: string | null
  notas_merma: string | null
}

type Props = {
  tipo: 'envasado' | 'fresco'
  categorias: Categoria[]
  hoy: string
  name?: string
  unidadMedida?: string
}

function nuevaLinea(hoy: string): Linea {
  return {
    cantidad: '',
    cantidad_bruta: '',
    fecha_recepcion: hoy,
    hora_recepcion: '',
    ubicacion: 'ambiente',
    categoria_id: '',
    fecha_caducidad: '',
    fecha_caducidad_manual: false,
    notas: '',
    notas_merma: '',
  }
}

function calcularFechaParaLinea(linea: Linea, categorias: Categoria[]): string {
  if (!linea.categoria_id || !linea.fecha_recepcion) return ''
  const cat = categorias.find((c) => c.id === linea.categoria_id)
  if (!cat) return ''
  const dias =
    linea.ubicacion === 'refri' ? cat.dias_refri :
    linea.ubicacion === 'congelador' ? cat.dias_congelador :
    cat.dias_ambiente
  return dias ? calcularFechaCaducidad(linea.fecha_recepcion, dias) : ''
}

function fechaCaducidadEfectiva(
  linea: Linea,
  tipo: Props['tipo'],
  categorias: Categoria[],
): string {
  if (linea.fecha_caducidad_manual) return linea.fecha_caducidad
  if (tipo === 'fresco') return calcularFechaParaLinea(linea, categorias)
  return linea.fecha_caducidad
}

export default function CapturaLotes({
  tipo,
  categorias,
  hoy,
  name = 'lotes_json',
  unidadMedida = 'pieza',
}: Props) {
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea(hoy)])

  const esGranel = unidadMedida !== 'pieza'
  const step = stepCantidad(unidadMedida)
  const min = minCantidad(unidadMedida)

  function actualizar(idx: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)))
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, nuevaLinea(hoy)])
  }

  function quitarLinea(idx: number) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  const json = useMemo<LoteJson[]>(
    () =>
      lineas.map((l) => {
        const neta = parseFloat(l.cantidad) || 0
        const bruta = l.cantidad_bruta ? parseFloat(l.cantidad_bruta) || null : null
        return {
          cantidad: neta,
          cantidad_bruta: esGranel ? (bruta ?? neta) : null,
          fecha_recepcion: l.fecha_recepcion || hoy,
          hora_recepcion: tipo === 'fresco' ? (l.hora_recepcion || null) : null,
          ubicacion: l.ubicacion,
          fecha_caducidad: fechaCaducidadEfectiva(l, tipo, categorias) || null,
          notas: l.notas || null,
          notas_merma: esGranel && l.notas_merma ? l.notas_merma : null,
        }
      }),
    [lineas, tipo, hoy, categorias, esGranel],
  )

  const etiquetaCantidad = esGranel
    ? `Cantidad neta vendible (${unidadMedida})`
    : 'Cantidad'

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={JSON.stringify(json)} />

      {lineas.map((linea, idx) => (
        <div key={idx} className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {tipo === 'fresco' ? `Recepción ${idx + 1}` : `Lote ${idx + 1}`}
            </p>
            {lineas.length > 1 && (
              <button
                type="button"
                onClick={() => quitarLinea(idx)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Cantidad bruta — solo granel */}
          {esGranel && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Cantidad bruta recibida ({unidadMedida})
                </label>
                <input
                  type="number"
                  min={min}
                  step={step}
                  placeholder="Ej. 100"
                  value={linea.cantidad_bruta}
                  onChange={(e) => actualizar(idx, { cantidad_bruta: e.target.value })}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">Lo que recibiste del proveedor</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{etiquetaCantidad} *</label>
                <input
                  type="number"
                  min={min}
                  step={step}
                  required
                  placeholder="Ej. 60"
                  value={linea.cantidad}
                  onChange={(e) => actualizar(idx, { cantidad: e.target.value })}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">Stock que se registra (ya descontada la merma)</p>
              </div>
            </div>
          )}

          {/* Merma automática — solo granel */}
          {esGranel && linea.cantidad_bruta && linea.cantidad &&
            parseFloat(linea.cantidad_bruta) > 0 && parseFloat(linea.cantidad) > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Merma registrada:{' '}
                {(
                  ((parseFloat(linea.cantidad_bruta) - parseFloat(linea.cantidad)) /
                    parseFloat(linea.cantidad_bruta)) *
                  100
                ).toFixed(1)}
                %{' '}
                ({(parseFloat(linea.cantidad_bruta) - parseFloat(linea.cantidad)).toLocaleString('es-MX', { maximumFractionDigits: 3 })} {unidadMedida})
              </p>
            </div>
          )}

          {/* Cantidad — solo pieza */}
          {!esGranel && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={linea.cantidad}
                  onChange={(e) => actualizar(idx, { cantidad: e.target.value })}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Fecha de recepción</label>
                <input
                  type="date"
                  value={linea.fecha_recepcion}
                  onChange={(e) => actualizar(idx, { fecha_recepcion: e.target.value })}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {/* Fecha de recepción — granel en fila aparte */}
          {esGranel && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Fecha de recepción</label>
              <input
                type="date"
                value={linea.fecha_recepcion}
                onChange={(e) => actualizar(idx, { fecha_recepcion: e.target.value })}
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {tipo === 'fresco' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Hora de recepción</label>
                <input
                  type="time"
                  value={linea.hora_recepcion}
                  onChange={(e) => actualizar(idx, { hora_recepcion: e.target.value })}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Ubicación</label>
                <select
                  value={linea.ubicacion}
                  onChange={(e) => actualizar(idx, { ubicacion: e.target.value as Linea['ubicacion'] })}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ambiente">T° ambiente</option>
                  <option value="refri">Refrigerador</option>
                  <option value="congelador">Congelador</option>
                </select>
              </div>
            </div>
          )}

          {tipo === 'fresco' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Categoría de perecedero</label>
              {categorias.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay categorías configuradas. Podrás capturar la fecha de caducidad manualmente.
                </p>
              ) : (
                <select
                  value={linea.categoria_id}
                  onChange={(e) => actualizar(idx, { categoria_id: e.target.value, fecha_caducidad_manual: false })}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecciona para calcular automáticamente…</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Fecha de caducidad
              {tipo === 'envasado' && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
              )}
            </label>
            <input
              type="date"
              value={fechaCaducidadEfectiva(linea, tipo, categorias)}
              onChange={(e) => actualizar(idx, { fecha_caducidad: e.target.value, fecha_caducidad_manual: true })}
              className="rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
            />
            {tipo === 'fresco' && !linea.fecha_caducidad_manual && fechaCaducidadEfectiva(linea, tipo, categorias) && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ✓ Calculada automáticamente. Puedes ajustarla.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Notas (opcional)</label>
            <input
              value={linea.notas}
              onChange={(e) => actualizar(idx, { notas: e.target.value })}
              placeholder="Ej: proveedor, número de lote"
              className="rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {esGranel && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Notas de merma (opcional)</label>
              <input
                value={linea.notas_merma}
                onChange={(e) => actualizar(idx, { notas_merma: e.target.value })}
                placeholder="Ej: grasa excesiva, merma por limpieza"
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        </div>
      ))}

      {tipo === 'envasado' && (
        <button
          type="button"
          onClick={agregarLinea}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Plus className="h-4 w-4" />
          Agregar otra fecha de caducidad
        </button>
      )}
    </div>
  )
}
