export type UnidadMedida = 'pieza' | 'kg' | 'g' | 'litro' | 'ml'

export function esGranel(unidad: string): boolean {
  return unidad !== 'pieza'
}

export function formatCantidad(cantidad: number, unidad: string): string {
  if (unidad === 'pieza') return String(Math.round(cantidad))
  const n = unidad === 'g' || unidad === 'ml'
    ? Math.round(cantidad)
    : Math.round(cantidad * 1000) / 1000
  return `${n.toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${unidad}`
}

export function stepCantidad(unidad: string): string {
  if (unidad === 'pieza' || unidad === 'g' || unidad === 'ml') return '1'
  return '0.001'
}

export function minCantidad(unidad: string): number {
  if (unidad === 'pieza' || unidad === 'g' || unidad === 'ml') return 1
  return 0.001
}

export function parseCantidad(valor: string, unidad: string): number {
  const n = parseFloat(valor)
  if (isNaN(n) || n <= 0) return minCantidad(unidad)
  if (unidad === 'pieza') return Math.max(1, Math.floor(n))
  return Math.max(minCantidad(unidad), n)
}
