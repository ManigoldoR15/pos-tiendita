import { hoyMX, addDaysMX } from './fecha'

// Reglas de la suscripción mensual (acordadas con el dueño, jul-2026):
//   - 14 días de prueba gratis antes del primer cobro.
//   - Si el pago falla, 3 días de gracia con acceso antes de bloquear.
export const TRIAL_DIAS = 14
export const GRACIA_DIAS = 3

// Estado de la suscripción de un negocio, derivado del status crudo de Stripe.
//   sin_stripe → nunca puso tarjeta; lo gestiona el superadmin a mano.
//   prueba     → en periodo de prueba (Stripe: trialing).
//   activa     → pago al corriente (Stripe: active).
//   gracia     → falló el pago pero aún dentro de los días de gracia.
//   vencida    → falló el pago y se agotó la gracia (bloquea acceso).
//   cancelada  → suscripción cancelada o impaga (bloquea acceso).
export type EstadoSuscripcion =
  | 'sin_stripe'
  | 'prueba'
  | 'activa'
  | 'gracia'
  | 'vencida'
  | 'cancelada'

export type NegocioSuscripcion = {
  stripe_status: string | null
  suscripcion_fin: string | null // YYYY-MM-DD (fin del periodo pagado)
}

/** Estado de la suscripción. `hoy` se inyecta para poder testear. */
export function estadoSuscripcion(
  n: NegocioSuscripcion,
  hoy: string = hoyMX(),
): EstadoSuscripcion {
  const s = n.stripe_status
  if (!s) return 'sin_stripe'
  if (s === 'trialing') return 'prueba'
  if (s === 'active') return 'activa'
  if (s === 'past_due' || s === 'incomplete') {
    // Gracia: acceso hasta el fin del periodo + GRACIA_DIAS.
    if (n.suscripcion_fin) {
      const limite = addDaysMX(n.suscripcion_fin, GRACIA_DIAS)
      return hoy <= limite ? 'gracia' : 'vencida'
    }
    return 'gracia'
  }
  // canceled, unpaid, incomplete_expired, paused, …
  return 'cancelada'
}

/**
 * ¿Se debe bloquear el acceso al POS por falta de pago?
 * La suspensión manual del superadmin se maneja aparte (cuenta-suspendida);
 * esto es solo el bloqueo automático de Stripe. Un negocio sin Stripe
 * (sin_stripe) NUNCA se bloquea por aquí — lo controla el superadmin.
 */
export function accesoBloqueadoPorPago(
  n: NegocioSuscripcion,
  hoy: string = hoyMX(),
): boolean {
  const estado = estadoSuscripcion(n, hoy)
  return estado === 'vencida' || estado === 'cancelada'
}

export const ETIQUETA_ESTADO: Record<
  EstadoSuscripcion,
  { label: string; tono: 'verde' | 'azul' | 'ambar' | 'rojo' | 'gris' }
> = {
  activa:     { label: 'Suscripción activa', tono: 'verde' },
  prueba:     { label: 'Prueba gratis',      tono: 'azul' },
  gracia:     { label: 'Pago pendiente',     tono: 'ambar' },
  vencida:    { label: 'Suscripción vencida', tono: 'rojo' },
  cancelada:  { label: 'Suscripción cancelada', tono: 'rojo' },
  sin_stripe: { label: 'Sin suscripción',    tono: 'gris' },
}
