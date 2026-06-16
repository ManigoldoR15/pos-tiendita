// Paleta fija de colores de acento para categorías de producto.
// Se guarda solo la "key" en la BD — las clases se derivan aquí para
// garantizar contraste correcto tanto en modo claro como oscuro.
export const COLORES_CATEGORIA = [
  { key: 'red', label: 'Rojo', dot: 'bg-red-500', bar: 'bg-red-400 dark:bg-red-600', badge: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400' },
  { key: 'orange', label: 'Naranja', dot: 'bg-orange-500', bar: 'bg-orange-400 dark:bg-orange-600', badge: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800/40 dark:bg-orange-950/20 dark:text-orange-400' },
  { key: 'amber', label: 'Amarillo', dot: 'bg-amber-500', bar: 'bg-amber-400 dark:bg-amber-600', badge: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400' },
  { key: 'green', label: 'Verde', dot: 'bg-green-500', bar: 'bg-green-400 dark:bg-green-600', badge: 'border-green-300 bg-green-50 text-green-700 dark:border-green-800/40 dark:bg-green-950/20 dark:text-green-400' },
  { key: 'teal', label: 'Verde agua', dot: 'bg-teal-500', bar: 'bg-teal-400 dark:bg-teal-600', badge: 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-800/40 dark:bg-teal-950/20 dark:text-teal-400' },
  { key: 'blue', label: 'Azul', dot: 'bg-blue-500', bar: 'bg-blue-400 dark:bg-blue-600', badge: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/20 dark:text-blue-400' },
  { key: 'indigo', label: 'Índigo', dot: 'bg-indigo-500', bar: 'bg-indigo-400 dark:bg-indigo-600', badge: 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800/40 dark:bg-indigo-950/20 dark:text-indigo-400' },
  { key: 'purple', label: 'Morado', dot: 'bg-purple-500', bar: 'bg-purple-400 dark:bg-purple-600', badge: 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800/40 dark:bg-purple-950/20 dark:text-purple-400' },
  { key: 'pink', label: 'Rosa', dot: 'bg-pink-500', bar: 'bg-pink-400 dark:bg-pink-600', badge: 'border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-800/40 dark:bg-pink-950/20 dark:text-pink-400' },
] as const

export type ColorCategoriaKey = (typeof COLORES_CATEGORIA)[number]['key']

export function getColorCategoria(key: string | null | undefined) {
  return COLORES_CATEGORIA.find((c) => c.key === key) ?? null
}
