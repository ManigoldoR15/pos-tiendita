import 'server-only'
import Stripe from 'stripe'

// Cliente de Stripe del lado servidor. STRIPE_SECRET_KEY es sk_test_... en
// modo prueba y sk_live_... en producción. 'server-only' hace que el build
// falle si este módulo se importa desde el navegador (la clave da acceso total
// a la cuenta de Stripe).
//
// Puede ser undefined si aún no se configuran las claves — las rutas que lo
// usan devuelven un error claro en vez de romper el arranque.
const secret = process.env.STRIPE_SECRET_KEY

export const stripe = secret ? new Stripe(secret) : null

export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID ?? ''

/** URL base pública para las redirecciones de Checkout/Portal. */
export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    'http://localhost:3000'
  )
}

export function stripeConfigurado(): boolean {
  return !!stripe && !!STRIPE_PRICE_ID
}
