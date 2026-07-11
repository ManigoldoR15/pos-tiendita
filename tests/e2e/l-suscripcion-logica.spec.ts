/**
 * Test l: LÓGICA DE SUSCRIPCIÓN (pura, sin Stripe ni servidor).
 *
 * Verifica el mapeo del status de Stripe a estado de cuenta y la regla de
 * bloqueo por falta de pago con días de gracia. Es la lógica que decide si un
 * negocio puede seguir usando el POS; un error aquí bloquea a quien paga o deja
 * pasar a quien no.
 */
import { test, expect } from '@playwright/test'
import {
  estadoSuscripcion,
  accesoBloqueadoPorPago,
  GRACIA_DIAS,
} from '../../src/lib/suscripcion'

const HOY = '2026-07-10'

test.describe('Estado de suscripción', () => {
  test('sin Stripe = sin_stripe y nunca bloquea (lo maneja el superadmin)', () => {
    const n = { stripe_status: null, suscripcion_fin: null }
    expect(estadoSuscripcion(n, HOY)).toBe('sin_stripe')
    expect(accesoBloqueadoPorPago(n, HOY)).toBe(false)
  })

  test('trialing = prueba, con acceso', () => {
    const n = { stripe_status: 'trialing', suscripcion_fin: '2026-07-24' }
    expect(estadoSuscripcion(n, HOY)).toBe('prueba')
    expect(accesoBloqueadoPorPago(n, HOY)).toBe(false)
  })

  test('active = activa, con acceso', () => {
    const n = { stripe_status: 'active', suscripcion_fin: '2026-08-10' }
    expect(estadoSuscripcion(n, HOY)).toBe('activa')
    expect(accesoBloqueadoPorPago(n, HOY)).toBe(false)
  })

  test('past_due DENTRO de la gracia = gracia, con acceso', () => {
    // fin = hoy → la gracia llega hasta hoy + GRACIA_DIAS
    const n = { stripe_status: 'past_due', suscripcion_fin: HOY }
    expect(estadoSuscripcion(n, HOY)).toBe('gracia')
    expect(accesoBloqueadoPorPago(n, HOY)).toBe(false)
  })

  test('past_due en el ÚLTIMO día de gracia sigue con acceso', () => {
    // fin hace GRACIA_DIAS días → límite = hoy exactamente
    const fin = '2026-07-07' // hoy - 3
    expect(GRACIA_DIAS).toBe(3)
    const n = { stripe_status: 'past_due', suscripcion_fin: fin }
    expect(estadoSuscripcion(n, HOY)).toBe('gracia')
    expect(accesoBloqueadoPorPago(n, HOY)).toBe(false)
  })

  test('past_due PASADA la gracia = vencida, bloquea', () => {
    const fin = '2026-07-06' // hoy - 4, límite fue ayer
    const n = { stripe_status: 'past_due', suscripcion_fin: fin }
    expect(estadoSuscripcion(n, HOY)).toBe('vencida')
    expect(accesoBloqueadoPorPago(n, HOY)).toBe(true)
  })

  test('canceled = cancelada, bloquea', () => {
    const n = { stripe_status: 'canceled', suscripcion_fin: '2026-08-10' }
    expect(estadoSuscripcion(n, HOY)).toBe('cancelada')
    expect(accesoBloqueadoPorPago(n, HOY)).toBe(true)
  })

  test('unpaid = cancelada, bloquea', () => {
    const n = { stripe_status: 'unpaid', suscripcion_fin: null }
    expect(estadoSuscripcion(n, HOY)).toBe('cancelada')
    expect(accesoBloqueadoPorPago(n, HOY)).toBe(true)
  })
})
