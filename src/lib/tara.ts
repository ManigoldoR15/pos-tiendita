// Calcula el peso neto restando la tara al peso bruto.
// Nunca devuelve negativo; respeta 3 decimales (numeric(12,3)).
export function calcPesoNeto(bruto: number, tara: number): number {
  const neto = bruto - tara
  if (neto <= 0) return 0
  return Math.round(neto * 1000) / 1000
}

export function stepTara(unidad: string): string {
  return unidad === 'g' || unidad === 'ml' ? '1' : '0.001'
}
