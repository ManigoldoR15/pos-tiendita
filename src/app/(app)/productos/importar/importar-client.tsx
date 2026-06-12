'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertTriangle, X, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatMXN } from '@/lib/dinero'
import { importarProductosAction } from './actions'

export type FilaImport = {
  nombre: string
  precio_venta: number     // centavos
  precio_costo: number     // centavos
  existencias: number
  codigo_barras: string
  categoria: string
  error?: string
}

function parsearFila(row: Record<string, string>): FilaImport {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
      if (v !== undefined && v !== '') return v.trim()
    }
    return ''
  }

  const toPrice = (v: string) => {
    const n = parseFloat(v.replace(/[$,\s]/g, ''))
    return isNaN(n) ? 0 : Math.round(n * 100)
  }

  const nombre = get('nombre', 'name', 'producto')
  const precio_venta = toPrice(get('precio', 'precio_venta', 'price', 'precio venta'))
  const precio_costo = toPrice(get('costo', 'precio_costo', 'cost', 'precio costo'))
  const existencias = parseInt(get('stock', 'existencias', 'cantidad', 'inventory') || '0') || 0
  const codigo_barras = get('codigo_barras', 'barcode', 'codigo', 'ean')
  const categoria = get('categoria', 'category', 'categoría')

  const error = !nombre
    ? 'Sin nombre'
    : precio_venta <= 0
      ? 'Precio inválido'
      : undefined

  return { nombre, precio_venta, precio_costo, existencias, codigo_barras, categoria, error }
}

async function parsearArchivo(file: File): Promise<FilaImport[]> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv')) {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase())
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = values[i] ?? '' })
      return parsearFila(row)
    }).filter((f) => f.nombre || f.precio_venta > 0)
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const { read, utils } = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const data = utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
    return data
      .map((row) => parsearFila(row as Record<string, string>))
      .filter((f) => f.nombre || f.precio_venta > 0)
  }

  return []
}

export default function ImportarProductosClient() {
  const [filas, setFilas] = useState<FilaImport[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: number; errores: number } | null>(null)
  const [archivoNombre, setArchivoNombre] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setCargando(true)
    setFilas(null)
    setResultado(null)
    setArchivoNombre(file.name)
    try {
      const rows = await parsearArchivo(file)
      setFilas(rows)
    } catch {
      setFilas([])
    } finally {
      setCargando(false)
    }
  }

  async function handleImportar() {
    if (!filas) return
    const validas = filas.filter((f) => !f.error)
    if (validas.length === 0) return

    setImportando(true)
    const res = await importarProductosAction(validas)
    setImportando(false)
    setResultado(res)
    setFilas(null)
  }

  const filasValidas = filas?.filter((f) => !f.error) ?? []
  const filasConError = filas?.filter((f) => f.error) ?? []

  if (resultado) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
        <CheckCircle className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
        <p className="text-lg font-bold">Importación completada</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {resultado.ok} productos importados correctamente.
          {resultado.errores > 0 && ` ${resultado.errores} filas omitidas por errores.`}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => { setResultado(null); setFilas(null) }}>
            Importar otro archivo
          </Button>
          <Button asChild>
            <a href="/productos">Ver productos</a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Plantilla descargable */}
      <div className="rounded-xl border bg-muted/40 p-4 text-sm">
        <p className="font-medium">Columnas esperadas en el archivo:</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          nombre, precio, costo, stock, codigo_barras, categoria
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Solo <strong>nombre</strong> y <strong>precio</strong> son obligatorios.
          El resto es opcional. Acepta CSV (.csv) y Excel (.xlsx).
        </p>
      </div>

      {/* Drop zone */}
      {!filas && !cargando && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card py-14 text-center hover:border-primary/60 hover:bg-accent transition-colors"
        >
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Arrastra tu archivo aquí</p>
            <p className="text-sm text-muted-foreground">o haz clic para seleccionar</p>
          </div>
          <p className="text-xs text-muted-foreground">CSV · XLSX · XLS</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </div>
      )}

      {cargando && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent mr-3" />
          Procesando {archivoNombre}…
        </div>
      )}

      {/* Preview */}
      {filas && filas.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-orange-400" />
          <p>No se encontraron filas válidas en el archivo.</p>
          <Button variant="outline" className="mt-4" onClick={() => setFilas(null)}>
            Intentar con otro archivo
          </Button>
        </div>
      )}

      {filas && filas.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{archivoNombre}</p>
              <p className="text-sm text-muted-foreground">
                <span className="text-emerald-600 font-medium">{filasValidas.length} válidas</span>
                {filasConError.length > 0 && (
                  <span className="ml-2 text-destructive">{filasConError.length} con error</span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setFilas(null); setArchivoNombre('') }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabla preview */}
          <div className="overflow-x-auto rounded-xl border shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-right">Precio</th>
                  <th className="px-3 py-2 text-right">Costo</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2 text-left">Categoría</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-card">
                {filas.slice(0, 50).map((f, i) => (
                  <tr key={i} className={cn(f.error && 'bg-destructive/5')}>
                    <td className="px-3 py-2 font-medium max-w-[180px] truncate">{f.nombre || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {f.precio_venta > 0 ? formatMXN(f.precio_venta) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {f.precio_costo > 0 ? formatMXN(f.precio_costo) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{f.existencias}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">
                      {f.categoria || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {f.error ? (
                        <span className="text-xs text-destructive font-medium">{f.error}</span>
                      ) : (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filas.length > 50 && (
              <p className="px-3 py-2 text-xs text-muted-foreground border-t">
                Mostrando 50 de {filas.length} filas. Todas se importarán.
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setFilas(null); setArchivoNombre('') }}>
              Cancelar
            </Button>
            <Button
              onClick={handleImportar}
              disabled={importando || filasValidas.length === 0}
            >
              <Upload className="h-4 w-4" />
              {importando ? 'Importando…' : `Importar ${filasValidas.length} productos`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
