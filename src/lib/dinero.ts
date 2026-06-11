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
