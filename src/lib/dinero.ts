export function formatMXN(centavos: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(centavos / 100)
}

export function centavosATexto(centavos: number): string {
  return (centavos / 100).toFixed(2)
}

export function textoCentavos(texto: string): number {
  const n = parseFloat(texto.replace(',', '.'))
  if (isNaN(n) || n < 0) return 0
  return Math.round(n * 100)
}

const UNIDAD_LABELS: Record<string, string> = {
  pieza: 'pza',
  kg: 'kg',
  g: 'g',
  litro: 'L',
  ml: 'ml',
}

export function formatUnidad(cantidad: number, unidad: string): string {
  const label = UNIDAD_LABELS[unidad] ?? unidad
  const n = Number.isInteger(cantidad) ? cantidad.toString() : cantidad.toFixed(3).replace(/\.?0+$/, '')
  return `${n} ${label}`
}
