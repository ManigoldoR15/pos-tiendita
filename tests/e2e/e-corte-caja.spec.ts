import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { adminSupabase, userSupabase } from '../helpers/supa'
import { TEST_DUENO } from '../global-setup'

const STORAGE = path.join(__dirname, '../.auth/dueno.json')
const FIXTURE = path.join(__dirname, '../.auth/fixture.json')
test.use({ storageState: STORAGE })

test.describe('Corte de caja', () => {
  let negocioId: string

  test.beforeAll(async () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    negocioId = fixture.negocioId
    // Close any open corte
    const admin = adminSupabase()
    await admin
      .from('cortes_caja')
      .update({
        estado: 'cerrado',
        fecha_cierre: new Date().toISOString(),
        monto_contado: 0,
        diferencia: 0,
        monto_esperado: 0,
      })
      .eq('negocio_id', negocioId)
      .eq('estado', 'abierto')
  })

  test('abrir corte con fondo inicial de $500', async ({ page }) => {
    await page.goto('/corte')
    await page.waitForLoadState('networkidle')

    const montoInput = page.locator('input[name="monto_inicial"]')
    await expect(montoInput).toBeVisible({ timeout: 5000 })
    await montoInput.fill('500')

    await page.locator('button').filter({ hasText: /abrir caja/i }).click()
    await page.waitForTimeout(1500)

    await expect(page.locator('text=/abierta/i')).toBeVisible({ timeout: 5000 })
  })

  test('cerrar corte con monto distinto al esperado', async ({ page }) => {
    await page.goto('/corte')
    await page.waitForLoadState('networkidle')

    // Caja must be open — enter a different monto_contado
    const cerrarInput = page.locator('input[name="monto_contado"]')
    await expect(cerrarInput).toBeVisible({ timeout: 5000 })
    await cerrarInput.fill('450') // intentionally less than 500

    await page.locator('button').filter({ hasText: /confirmar cierre/i }).click()
    await page.waitForTimeout(1500)

    // Should show closed state
    await page.reload()
    await expect(page.locator('text=/diferencia|cerrado|último corte/i').first()).toBeVisible({ timeout: 8000 })
  })

  test('diferencia calculada correctamente en DB', async () => {
    const admin = adminSupabase()
    const { data: corte } = await admin
      .from('cortes_caja')
      .select('monto_inicial, monto_contado, monto_esperado, diferencia')
      .eq('negocio_id', negocioId)
      .eq('estado', 'cerrado')
      .order('fecha_cierre', { ascending: false })
      .limit(1)
      .single()

    expect(corte).not.toBeNull()
    const diferenciaEsperada = corte!.monto_contado - corte!.monto_esperado
    expect(corte!.diferencia).toBe(diferenciaEsperada)
  })
})

/**
 * Con dos plazas operando a la vez —cada una con su caja abierta— cada venta
 * debe caer en la caja de SU plaza. Antes de la migración 075, registrar_venta
 * tomaba "el corte abierto" con LIMIT 1 sin filtro: las ventas de una plaza
 * podían contarse en el cajón de la otra.
 */
test.describe('Dos cajas abiertas: cada venta cae en la caja de su plaza', () => {
  const admin = adminSupabase()
  let negocioId: string
  let duenoId: string
  let plazaA: string
  let plazaB: string
  let corteA: string
  let corteB: string
  let productoId: string
  let metodoId: string
  let maxCajasPrevio: number
  const ventasCreadas: string[] = []
  const PRODUCTO = `QA Caja Plaza ${Date.now()}`

  test.beforeAll(async () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    negocioId = fixture.negocioId
    duenoId = fixture.duenoId

    // Se necesitan 2 cajas abiertas a la vez; el negocio de pruebas conserva
    // su max_cajas anterior al terminar.
    const { data: neg } = await admin.from('negocios').select('max_cajas').eq('id', negocioId).single()
    maxCajasPrevio = neg!.max_cajas
    await admin.from('negocios').update({ max_cajas: 5, max_plazas: 3 }).eq('id', negocioId)

    const { data: existentes } = await admin
      .from('locales').select('id').eq('negocio_id', negocioId).eq('activo', true).order('created_at')
    const plazas = existentes ?? []
    for (const nombre of ['QA Plaza Uno', 'QA Plaza Dos']) {
      if (plazas.length >= 2) break
      const { data } = await admin
        .from('locales').insert({ negocio_id: negocioId, nombre, activo: true }).select('id').single()
      if (data) plazas.push(data)
    }
    plazaA = plazas[0].id
    plazaB = plazas[1].id

    // Producto con stock en ambas plazas
    const { data: prod } = await admin.from('productos').insert({
      negocio_id: negocioId, nombre: PRODUCTO, precio_venta: 1500,
      existencias: 0, unidad_medida: 'pieza', activo: true,
    }).select('id').single()
    productoId = prod!.id
    const hoy = new Date().toISOString().slice(0, 10)
    await admin.from('lotes_producto').insert([
      { negocio_id: negocioId, producto_id: productoId, cantidad: 5, cantidad_actual: 5, fecha_recepcion: hoy, ubicacion: 'ambiente', local_id: plazaA, activo: true },
      { negocio_id: negocioId, producto_id: productoId, cantidad: 5, cantidad_actual: 5, fecha_recepcion: hoy, ubicacion: 'ambiente', local_id: plazaB, activo: true },
    ])

    const { data: metodo } = await admin
      .from('metodos_pago').select('id').eq('negocio_id', negocioId).eq('activo', true).limit(1).single()
    metodoId = metodo!.id

    // Una caja abierta por plaza
    const { data: cA } = await admin.from('cortes_caja').insert({
      negocio_id: negocioId, abierto_por: duenoId, monto_inicial: 0, estado: 'abierto', local_id: plazaA,
    }).select('id').single()
    const { data: cB } = await admin.from('cortes_caja').insert({
      negocio_id: negocioId, abierto_por: duenoId, monto_inicial: 0, estado: 'abierto', local_id: plazaB,
    }).select('id').single()
    corteA = cA!.id
    corteB = cB!.id
  })

  test.afterAll(async () => {
    // Las ventas de la suite no deben quedar en cortes que otros specs cierran
    if (ventasCreadas.length > 0) {
      const { data: items } = await admin.from('venta_items').select('id').in('venta_id', ventasCreadas)
      await admin.from('venta_lotes').delete().in('venta_item_id', (items ?? []).map((i) => i.id))
      await admin.from('ventas').delete().in('id', ventasCreadas)
    }
    await admin.from('cortes_caja').delete().in('id', [corteA, corteB])
    await admin.from('lotes_producto').delete().eq('producto_id', productoId)
    await admin.from('productos').delete().eq('id', productoId)
    await admin.from('negocios').update({ max_cajas: maxCajasPrevio }).eq('id', negocioId)
  })

  test('la venta de cada plaza queda en su corte, no en el otro', async () => {
    const dueno = await userSupabase(TEST_DUENO.email, TEST_DUENO.password)

    // Venta en la plaza B (la caja de A también está abierta)
    const { data: ventaB, error: errB } = await dueno.rpc('registrar_venta', {
      p_negocio_id: negocioId,
      p_items: [{ producto_id: productoId, cantidad: 1 }],
      p_metodo_pago_id: metodoId,
      p_pago_recibido: 5000,
      p_local_id: plazaB,
    })
    expect(errB).toBeNull()
    ventasCreadas.push(ventaB as string)

    // Venta en la plaza A
    const { data: ventaA, error: errA } = await dueno.rpc('registrar_venta', {
      p_negocio_id: negocioId,
      p_items: [{ producto_id: productoId, cantidad: 1 }],
      p_metodo_pago_id: metodoId,
      p_pago_recibido: 5000,
      p_local_id: plazaA,
    })
    expect(errA).toBeNull()
    ventasCreadas.push(ventaA as string)

    const { data: filas } = await admin
      .from('ventas').select('id, corte_id').in('id', [ventaA as string, ventaB as string])
    const corteDe = new Map((filas ?? []).map((f) => [f.id, f.corte_id]))
    expect(corteDe.get(ventaA as string)).toBe(corteA)
    expect(corteDe.get(ventaB as string)).toBe(corteB)
  })

  test('el trigger de licencia sigue limitando cajas de más', async () => {
    // Con max_cajas = 5 y 2 abiertas cabe otra; al bajar el límite a 2, no.
    await admin.from('negocios').update({ max_cajas: 2 }).eq('id', negocioId)
    const { error } = await admin.from('cortes_caja').insert({
      negocio_id: negocioId, abierto_por: duenoId, monto_inicial: 0, estado: 'abierto', local_id: null,
    })
    expect(error?.message ?? '').toContain('LIMITE_CAJAS')
    await admin.from('negocios').update({ max_cajas: 5 }).eq('id', negocioId)
  })
})
