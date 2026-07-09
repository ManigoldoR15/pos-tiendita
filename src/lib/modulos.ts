// Server-only — NO importar desde Client Components
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getNegocioActual } from './negocio'
import { MODULOS_DEFAULT } from './modulos-config'
import type { ModuloKey, ModulosConfig } from './modulos-config'

export type { ModuloKey, ModulosConfig }
export { MODULOS_META, MODULOS_DEFAULT, PAQUETES } from './modulos-config'

export const getModulos = cache(async (): Promise<ModulosConfig> => {
  const negocio = await getNegocioActual()
  const raw = negocio?.modulos_habilitados ?? null
  if (!raw) return { ...MODULOS_DEFAULT }
  return {
    fiados:              raw.fiados              ?? true,
    granel:              raw.granel              ?? true,
    turnos:              raw.turnos              ?? true,
    exportacion:         raw.exportacion         ?? true,
    multi_plaza:         raw.multi_plaza         ?? true,
    clientes_frecuentes: raw.clientes_frecuentes ?? true,
    proveedores:         raw.proveedores         ?? true,
    metas:               raw.metas               ?? true,
    repartidores:        raw.repartidores        ?? false,
    variantes:           raw.variantes           ?? false,
    caducidad:           raw.caducidad           ?? true,
  }
})

export async function requireModulo(key: ModuloKey): Promise<void> {
  const modulos = await getModulos()
  if (!modulos[key]) redirect('/')
}
