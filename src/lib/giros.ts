// Plantillas por giro de negocio — configuración inicial que el alta siembra
// según el tipo de negocio. Los giros sin plantilla usan el comportamiento
// estándar de tiendita (sin categorías precargadas, caducidad activa).

import type { ModuloKey } from './modulos-config'

export type PlantillaGiro = {
  /** Categorías de producto que se precargan */
  categoriasProducto: string[]
  /** Categorías de gasto ADICIONALES a las 9 estándar */
  categoriasGastoExtra: string[]
  /** Módulos que este giro enciende (si el paquete POS fue comprado) */
  modulosOn: ModuloKey[]
  /** Módulos que este giro apaga (no aplican a su operación) */
  modulosOff: ModuloKey[]
}

export const PLANTILLAS_GIRO: Partial<Record<string, PlantillaGiro>> = {
  ropa: {
    categoriasProducto: ['Playeras', 'Pantalones', 'Vestidos', 'Chamarras', 'Calzado', 'Accesorios'],
    categoriasGastoExtra: ['Tela e insumos', 'Hilos y mercería', 'Maquila'],
    modulosOn: ['variantes', 'apartados'],
    modulosOff: ['caducidad', 'granel'],
  },
  farmacia: {
    categoriasProducto: ['Medicamentos', 'Higiene personal', 'Bebés', 'Vitaminas y suplementos', 'Material de curación'],
    categoriasGastoExtra: [],
    modulosOn: [],
    modulosOff: ['granel'],
  },
  ferreteria: {
    categoriasProducto: ['Herramientas', 'Material eléctrico', 'Plomería', 'Pinturas', 'Tornillería y fijación'],
    categoriasGastoExtra: [],
    modulosOn: ['variantes'],
    modulosOff: ['caducidad'],
  },
  papeleria: {
    categoriasProducto: ['Cuadernos', 'Escritura', 'Arte y manualidades', 'Oficina'],
    categoriasGastoExtra: [],
    modulosOn: [],
    modulosOff: ['caducidad', 'granel'],
  },
}

/** Categorías de gasto estándar — mismas que siembra crear_negocio() en SQL */
export const CATEGORIAS_GASTO_ESTANDAR = [
  'Luz', 'Agua', 'Gas', 'Renta', 'Gasolina', 'Sueldos', 'Mercancía',
  'Internet y teléfono', 'Otro',
]

/** Métodos de pago estándar — mismos que siembra crear_negocio() en SQL */
export const METODOS_PAGO_ESTANDAR = [
  'Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Transferencia (SPEI)',
]
