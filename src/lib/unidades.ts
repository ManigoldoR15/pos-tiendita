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

/**
 * Lo que el mostrador va tecleando en una casilla de cantidad, convertido a
 * número — o null mientras todavía no es un número usable ("", "0.", "-").
 *
 * Existe por un bug real: la casilla del carrito es un input controlado con
 * value={item.cantidad}, y cada tecla escribía de vuelta un valor saneado con
 * un mínimo forzado. Al teclear "0.5" en un producto por kg, el "0" se
 * convertía en 0.001 antes de alcanzar a escribir el resto, y acababa
 * registrando 0.0015 kg. Devolver null deja que el texto a medias siga en
 * pantalla sin tocar el carrito hasta que signifique algo.
 */
export function cantidadTecleada(texto: string, unidad: string): number | null {
  const n = parseFloat(texto)
  if (!Number.isFinite(n) || n <= 0) return null
  if (unidad === 'pieza') return Math.floor(n) || null
  return n
}
