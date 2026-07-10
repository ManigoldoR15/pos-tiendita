/**
 * Test i: FLUJO REPARTIDOR PUNTA A PUNTA.
 *
 * Cubre el ciclo completo del módulo de flotilla (migs. 055-057):
 *   dueño entrega carga (descuenta stock FEFO) → repartidor la ve en /mi-carga
 *   → confirma, o rechaza (restituye stock con lote de devolución).
 * También verifica que las reglas de rol viven en la base de datos.
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { adminSupabase, userSupabase } from '../helpers/supa'
import { TEST_DUENO, TEST_EMPLEADO, TEST_REPARTIDOR } from '../global-setup'

const FIXTURE = path.join(__dirname, '../.auth/fixture.json')
const AUTH_REPARTIDOR = path.join(__dirname, '../.auth/repartidor.json')

async function stockDe(productoId: string): Promise<number> {
  const admin = adminSupabase()
  const { data } = await admin.from('productos').select('existencias').eq('id', productoId).single()
  return Number(data?.existencias ?? -1)
}

test.describe('Flujo repartidor: entrega de carga punta a punta', () => {
  let negocioId: string
  let repartidorId: string
  let productoId: string
  const STOCK_INICIAL = 20

  test.beforeAll(async () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    negocioId = fixture.negocioId
    repartidorId = fixture.repartidorId

    // Producto fresco con stock controlado (el trigger de lotes sincroniza existencias)
    const admin = adminSupabase()
    const { data: prod, error } = await admin
      .from('productos')
      .insert({
        negocio_id: negocioId,
        nombre: `Entrega Test ${Date.now()}`,
        precio_venta: 3000,
        precio_costo: 2000,
        existencias: 0,
        activo: true,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    productoId = prod.id
    await admin.from('lotes_producto').insert({
      negocio_id: negocioId,
      producto_id: productoId,
      cantidad: STOCK_INICIAL,
      cantidad_actual: STOCK_INICIAL,
    })
  })

  test.afterAll(async () => {
    // Desactivar el producto de prueba para no ensuciar el catálogo
    const admin = adminSupabase()
    if (productoId) await admin.from('productos').update({ activo: false }).eq('id', productoId)
  })

  test('dueño entrega carga → stock baja (FEFO)', async () => {
    expect(await stockDe(productoId)).toBe(STOCK_INICIAL)

    const dueno = await userSupabase(TEST_DUENO.email, TEST_DUENO.password)
    const { data: entregaId, error } = await dueno.rpc('crear_entrega_repartidor', {
      p_negocio_id: negocioId,
      p_repartidor_id: repartidorId,
      p_items: [{ producto_id: productoId, cantidad: 5 }],
      p_local_id: null,
      p_nota: 'Carga E2E',
    })
    expect(error, `crear_entrega_repartidor falló: ${error?.message}`).toBeNull()
    expect(entregaId).toBeTruthy()
    expect(await stockDe(productoId)).toBe(STOCK_INICIAL - 5)
  })

  test('repartidor ve la entrega pendiente en /mi-carga y la confirma', async ({ browser }) => {
    // UI: la página muestra la carga por confirmar
    const ctx = await browser.newContext({ storageState: AUTH_REPARTIDOR })
    const page = await ctx.newPage()
    await page.goto('/mi-carga')
    await expect(page.getByRole('heading', { name: 'Mi carga' })).toBeVisible()
    await expect(page.getByText('Por confirmar')).toBeVisible()
    await ctx.close()

    // RPC: confirmar la entrega pendiente
    const repartidor = await userSupabase(TEST_REPARTIDOR.email, TEST_REPARTIDOR.password)
    const { data: pendientes } = await repartidor
      .from('entregas_repartidor')
      .select('id')
      .eq('negocio_id', negocioId)
      .eq('repartidor_id', repartidorId)
      .eq('estado', 'pendiente')
    expect(pendientes?.length).toBeGreaterThan(0)

    const { error } = await repartidor.rpc('responder_entrega_repartidor', {
      p_entrega_id: pendientes![0].id,
      p_aceptar: true,
      p_nota: null,
    })
    expect(error, `responder falló: ${error?.message}`).toBeNull()

    const admin = adminSupabase()
    const { data: entrega } = await admin
      .from('entregas_repartidor').select('estado').eq('id', pendientes![0].id).single()
    expect(entrega?.estado).toBe('confirmada')
    // Confirmar NO devuelve stock: la carga salió de la tienda
    expect(await stockDe(productoId)).toBe(STOCK_INICIAL - 5)
  })

  test('repartidor rechaza una entrega → el stock se restituye', async () => {
    const dueno = await userSupabase(TEST_DUENO.email, TEST_DUENO.password)
    const { data: entregaId, error: errCrear } = await dueno.rpc('crear_entrega_repartidor', {
      p_negocio_id: negocioId,
      p_repartidor_id: repartidorId,
      p_items: [{ producto_id: productoId, cantidad: 4 }],
      p_local_id: null,
      p_nota: null,
    })
    expect(errCrear, errCrear?.message).toBeNull()
    expect(await stockDe(productoId)).toBe(STOCK_INICIAL - 5 - 4)

    const repartidor = await userSupabase(TEST_REPARTIDOR.email, TEST_REPARTIDOR.password)
    const { error } = await repartidor.rpc('responder_entrega_repartidor', {
      p_entrega_id: entregaId,
      p_aceptar: false,
      p_nota: 'No cabe en la moto',
    })
    expect(error, `rechazo falló: ${error?.message}`).toBeNull()

    const admin = adminSupabase()
    const { data: entrega } = await admin
      .from('entregas_repartidor').select('estado, nota_respuesta').eq('id', entregaId).single()
    expect(entrega?.estado).toBe('rechazada')
    expect(await stockDe(productoId)).toBe(STOCK_INICIAL - 5)
  })

  test('entrega con stock insuficiente es rechazada por la DB', async () => {
    const dueno = await userSupabase(TEST_DUENO.email, TEST_DUENO.password)
    const { error } = await dueno.rpc('crear_entrega_repartidor', {
      p_negocio_id: negocioId,
      p_repartidor_id: repartidorId,
      p_items: [{ producto_id: productoId, cantidad: 9999 }],
      p_local_id: null,
      p_nota: null,
    })
    expect(error).not.toBeNull()
    expect(await stockDe(productoId)).toBe(STOCK_INICIAL - 5)
  })

  // ── Seguridad: las reglas de rol viven en la DB ────────────────────────────

  test('[CRÍTICO] un repartidor NO puede crear entregas', async () => {
    const repartidor = await userSupabase(TEST_REPARTIDOR.email, TEST_REPARTIDOR.password)
    const { error } = await repartidor.rpc('crear_entrega_repartidor', {
      p_negocio_id: negocioId,
      p_repartidor_id: repartidorId,
      p_items: [{ producto_id: productoId, cantidad: 1 }],
      p_local_id: null,
      p_nota: null,
    })
    expect(error, 'La DB debe rechazar a un repartidor creando entregas').not.toBeNull()
  })

  test('[CRÍTICO] un empleado NO puede responder la entrega de otro', async () => {
    const dueno = await userSupabase(TEST_DUENO.email, TEST_DUENO.password)
    const { data: entregaId } = await dueno.rpc('crear_entrega_repartidor', {
      p_negocio_id: negocioId,
      p_repartidor_id: repartidorId,
      p_items: [{ producto_id: productoId, cantidad: 1 }],
      p_local_id: null,
      p_nota: null,
    })

    const empleado = await userSupabase(TEST_EMPLEADO.email, TEST_EMPLEADO.password)
    const { error } = await empleado.rpc('responder_entrega_repartidor', {
      p_entrega_id: entregaId,
      p_aceptar: true,
      p_nota: null,
    })
    expect(error, 'Solo el repartidor destinatario puede responder').not.toBeNull()

    // Limpieza: el repartidor la rechaza para devolver el stock
    const repartidor = await userSupabase(TEST_REPARTIDOR.email, TEST_REPARTIDOR.password)
    await repartidor.rpc('responder_entrega_repartidor', {
      p_entrega_id: entregaId,
      p_aceptar: false,
      p_nota: 'limpieza test',
    })
  })
})
