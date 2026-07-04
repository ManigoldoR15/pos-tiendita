import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { adminSupabase, userSupabase } from '../helpers/supa'
import { TEST_DUENO, TEST_EMPLEADO, TEST_ADMIN } from '../global-setup'

const STORAGE = path.join(__dirname, '../.auth/dueno.json')
const FIXTURE = path.join(__dirname, '../.auth/fixture.json')
test.use({ storageState: STORAGE })

test.describe('Anular venta: stock se restaura', () => {
  let ventaId: string
  let productoId: string
  let stockAntes: number

  test.beforeAll(async () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    const { negocioId, duenoId } = fixture
    const admin = adminSupabase()

    const { data: prod } = await admin
      .from('productos')
      .select('id, precio_venta, existencias')
      .eq('negocio_id', negocioId)
      .eq('activo', true)
      .gt('existencias', 1)
      .order('nombre')
      .limit(1)
      .single()
    if (!prod) throw new Error('No hay producto con stock > 1')
    productoId = prod.id
    stockAntes = prod.existencias

    const { data: mp } = await admin
      .from('metodos_pago')
      .select('id')
      .eq('negocio_id', negocioId)
      .limit(1)
      .single()
    if (!mp) throw new Error('No hay método de pago')

    // Create sale as dueño
    const duenoClient = await userSupabase('test-dueno@pos-test.local', TEST_DUENO.password)
    const { data: vid, error } = await duenoClient.rpc('registrar_venta', {
      p_negocio_id: negocioId,
      p_items: [{ producto_id: productoId, cantidad: 1 }],
      p_metodo_pago_id: mp.id,
      p_cliente_id: null,
      p_pago_recibido: null,
      p_descuento: 0,
      p_vendedor_id: duenoId,
    })
    if (error) throw new Error(`Cannot create sale: ${error.message}`)
    ventaId = vid as string
  })

  test('botón Anular venta visible para dueño', async ({ page }) => {
    await page.goto(`/ventas/${ventaId}`)
    await page.waitForLoadState('networkidle')
    const anularBtn = page.locator('button').filter({ hasText: /anular venta/i })
    await expect(anularBtn).toBeVisible({ timeout: 5000 })
  })

  test('anular venta muestra estado Cancelada', async ({ page }) => {
    await page.goto(`/ventas/${ventaId}`)
    await page.waitForLoadState('networkidle')
    const anularBtn = page.locator('button').filter({ hasText: /anular venta/i })
    await anularBtn.click()
    const confirmarBtn = page.locator('button').filter({ hasText: /sí, anular/i })
    await expect(confirmarBtn).toBeVisible({ timeout: 3000 })
    await confirmarBtn.click()
    await page.waitForTimeout(2500)
    await expect(page.locator('text=/[Cc]ancelada/i')).toBeVisible({ timeout: 8000 })
  })

  test('stock restaurado en la base de datos', async () => {
    const admin = adminSupabase()
    const { data } = await admin.from('productos').select('existencias').eq('id', productoId).single()
    expect(data!.existencias).toBe(stockAntes)
  })
})
