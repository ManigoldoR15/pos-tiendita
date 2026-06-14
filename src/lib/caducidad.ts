export type EstadoLote = 'verde' | 'amarillo' | 'rojo' | 'negro'

export const ESTADO_CONFIG: Record<EstadoLote, {
  label: string
  labelCorto: string
  bg: string
  text: string
  border: string
  dot: string
}> = {
  verde: {
    label: 'En buen estado',
    labelCorto: 'Verde',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    dot: 'bg-emerald-500',
  },
  amarillo: {
    label: 'Próximo a vencer',
    labelCorto: 'Amarillo',
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    text: 'text-yellow-700 dark:text-yellow-500',
    border: 'border-yellow-200 dark:border-yellow-800/40',
    dot: 'bg-yellow-400',
  },
  rojo: {
    label: 'Vence pronto / recién vencido',
    labelCorto: 'Rojo',
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800/40',
    dot: 'bg-red-500',
  },
  negro: {
    label: 'No apto / desechar',
    labelCorto: 'Negro',
    bg: 'bg-gray-100 dark:bg-gray-800/60',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-300 dark:border-gray-700',
    dot: 'bg-gray-500',
  },
}

export const ESTADO_ORDEN: EstadoLote[] = ['negro', 'rojo', 'amarillo', 'verde']

export const UBICACION_LABELS: Record<string, string> = {
  refri:      'Refrigerador',
  congelador: 'Congelador',
  ambiente:   'T° ambiente',
}

// Valores FDA/FAO/AESAN para sembrar en cada negocio al primer uso
export const DEFAULTS_PERECEDERO = [
  { nombre: 'Res cruda',        dias_refri: 4,  dias_congelador: 360, dias_ambiente: null, orden: 1 },
  { nombre: 'Cerdo crudo',      dias_refri: 4,  dias_congelador: 180, dias_ambiente: null, orden: 2 },
  { nombre: 'Pollo crudo',      dias_refri: 2,  dias_congelador: 270, dias_ambiente: null, orden: 3 },
  { nombre: 'Carne molida',     dias_refri: 2,  dias_congelador: 120, dias_ambiente: null, orden: 4 },
  { nombre: 'Pescado/mariscos', dias_refri: 2,  dias_congelador: 180, dias_ambiente: null, orden: 5 },
  { nombre: 'Embutidos',        dias_refri: 2,  dias_congelador: 60,  dias_ambiente: null, orden: 6 },
  { nombre: 'Lácteos frescos',  dias_refri: 7,  dias_congelador: null, dias_ambiente: null, orden: 7 },
]

// Umbrales del semáforo
const UMBRAL_AMARILLO_DIAS = 3    // ≤ 3 días → amarillo
const UMBRAL_AMARILLO_PCT  = 0.20 // ≤ 20 % de vida restante → amarillo
const UMBRAL_NEGRO_DIAS    = -7   // vencido hace > 7 días → negro

export function calcularEstado(opts: {
  fechaCaducidad: string   // YYYY-MM-DD
  fechaRecepcion: string   // YYYY-MM-DD
  tipoCaducidad: 'envasado' | 'fresco' | null
  estadoManual?: string | null
  hoy?: string             // YYYY-MM-DD, para tests
}): EstadoLote {
  if (opts.estadoManual === 'negro') return 'negro'

  const msDay = 86_400_000
  const hoy = opts.hoy ? new Date(opts.hoy + 'T12:00:00Z') : (() => {
    const d = new Date(); d.setHours(12, 0, 0, 0); return d
  })()
  const caducidad = new Date(opts.fechaCaducidad + 'T12:00:00Z')
  const recepcion = new Date(opts.fechaRecepcion + 'T12:00:00Z')

  const diasRestantes = Math.round((caducidad.getTime() - hoy.getTime()) / msDay)
  const vidaTotal     = Math.max(1, Math.round((caducidad.getTime() - recepcion.getTime()) / msDay))

  if (diasRestantes < UMBRAL_NEGRO_DIAS) return 'negro'
  if (diasRestantes < 0) return opts.tipoCaducidad === 'fresco' ? 'negro' : 'rojo'

  const pct = diasRestantes / vidaTotal
  if (pct <= UMBRAL_AMARILLO_PCT || diasRestantes <= UMBRAL_AMARILLO_DIAS) return 'amarillo'

  return 'verde'
}

export function diasRestantesTexto(dias: number): string {
  if (dias < 0)  return `Vencido hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `${dias} días`
}

export function calcularFechaCaducidad(
  fechaRecepcion: string,
  dias: number,
): string {
  const d = new Date(fechaRecepcion + 'T12:00:00Z')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}
