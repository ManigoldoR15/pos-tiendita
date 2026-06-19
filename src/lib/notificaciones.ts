import { createServiceClient } from '@/lib/supabase/service'

type NuevaNotificacion = {
  negocio_id: string
  tipo: 'ajuste_inventario' | 'diferencia_caja' | 'fiado' | 'fiado_lista_negra' | 'mensaje_empleado'
  titulo: string
  mensaje: string
  url?: string
  creado_por?: string | null
}

/**
 * Inserta una notificación sin bloquear la operación que la llama.
 * Si falla, solo loguea — nunca propaga el error.
 */
export function notificar(data: NuevaNotificacion): void {
  void (async () => {
    try {
      const { error } = await createServiceClient().from('notificaciones').insert(data)
      if (error) console.error('[notificaciones] error silencioso:', error.message)
    } catch (e) {
      console.error('[notificaciones] excepción silenciosa:', e)
    }
  })()
}
