export function calcPrecioFinal(
  precioVenta: number,
  tipo: 'porcentaje' | 'monto_fijo',
  valor: number,
): number {
  if (tipo === 'porcentaje') {
    return Math.max(0, Math.round((precioVenta * (10000 - valor)) / 10000))
  }
  return Math.max(0, precioVenta - valor)
}
