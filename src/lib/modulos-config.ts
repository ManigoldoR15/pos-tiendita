// Constantes puras — seguro para importar desde Client Components

export const MODULOS_META = {
  fiados:              { label: 'Fiados',              desc: 'Cuentas por cobrar y abonos' },
  granel:              { label: 'Granel / Cuadre',     desc: 'Merma, tara y cuadre antirrobo' },
  turnos:              { label: 'Turnos',               desc: 'Registro de entrada/salida de empleados' },
  exportacion:         { label: 'Exportación Excel',    desc: 'Descarga de ventas, gastos y productos' },
  multi_plaza:         { label: 'Multi-plaza',          desc: 'Varios locales por negocio' },
  clientes_frecuentes: { label: 'Clientes frecuentes',  desc: 'Clientes, historial y precios especiales' },
  proveedores:         { label: 'Proveedores',          desc: 'Catálogo de proveedores' },
  metas:               { label: 'Metas',                desc: 'Metas de ventas y proyección' },
} as const

export type ModuloKey = keyof typeof MODULOS_META
export type ModulosConfig = Record<ModuloKey, boolean>

export const MODULOS_DEFAULT: ModulosConfig = {
  fiados: true, granel: true, turnos: true, exportacion: true,
  multi_plaza: true, clientes_frecuentes: true, proveedores: true, metas: true,
}

export const PAQUETES: Record<string, { label: string; modulos: ModuloKey[] }> = {
  basico:   { label: 'Básico',   modulos: [] },
  negocio:  { label: 'Negocio',  modulos: ['fiados', 'turnos', 'granel', 'exportacion', 'clientes_frecuentes'] },
  completo: { label: 'Completo', modulos: Object.keys(MODULOS_META) as ModuloKey[] },
}
