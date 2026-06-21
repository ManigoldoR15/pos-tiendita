export const TIPOS_NEGOCIO = {
  tiendita:    { label: 'Tiendita',    emoji: '🏪' },
  abarrotes:   { label: 'Abarrotes',   emoji: '🛒' },
  carniceria:  { label: 'Carnicería',  emoji: '🥩' },
  taqueria:    { label: 'Taquería',    emoji: '🌮' },
  torteria:    { label: 'Tortería',    emoji: '🥖' },
  fruteria:    { label: 'Frutería',    emoji: '🍎' },
  farmacia:    { label: 'Farmacia',    emoji: '💊' },
  papeleria:   { label: 'Papelería',   emoji: '📝' },
  ferreteria:  { label: 'Ferretería',  emoji: '🔧' },
  cremeria:    { label: 'Cremería',    emoji: '🧀' },
  tortilleria: { label: 'Tortillería', emoji: '🫓' },
  panaderia:   { label: 'Panadería',   emoji: '🥐' },
  verduleria:  { label: 'Verdulería',  emoji: '🥬' },
  otro:        { label: 'Otro',        emoji: '🏬' },
} as const

export type TipoNegocio = keyof typeof TIPOS_NEGOCIO

export const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche',
  'Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango',
  'Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán',
  'Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco',
  'Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas',
] as const

export function tipoLabel(tipo: string) {
  const t = TIPOS_NEGOCIO[tipo as TipoNegocio]
  return t ? `${t.emoji} ${t.label}` : tipo
}
