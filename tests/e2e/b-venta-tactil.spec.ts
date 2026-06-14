import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { adminSupabase } from '../helpers/supa'

const STORAGE = path.join(__dirname, '../.auth/dueno.json')
const FIXTURE = path.join(__dirname, '../.auth/fixture.json')
test.use({ storageState: STORAGE })

test.describe('Venta táctil: agregar producto, cobrar, verificar stock', () => {
  let negocioId: string
  let productoId: string
  let stockAntes: number

  test.beforeAll(async () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    negocioId = fixture.negocioId
    const admin = adminSupabase()
    const { data } = await admin
      .from('productos')
      .select('id, existencias')
      .eq('negocio_id', negocioId)
      .eq('activo', true)
      .gt('existencias', 2)
      .order('nombre')
      .limit(1)
      .single()
    if (!data) throw new Error('No hay producto con stock > 2 para la prueba')
    productoId = data.id
    stockAntes = data.existencias
  })

  test('navegar a /pos sin redirigir a login', async ({ page }) => {
    await page.goto('/pos')
    await expect(page).not.toHaveURL(/login/)
    await page.waitForLoadState('networkidle')
  })

  test('modo táctil: agregar producto y cobrar', async ({ page }) => {
    await page.goto('/pos')
    await page.waitForLoadState('networkidle')

    // Switch to táctil if toggle exists
    const tactilBtn = page.locator('button').filter({ hasText: /táctil/i })
    if (await tactilBtn.count() > 0) {
      await tactilBtn.first().click()
      await page.waitForTimeout(300)
    }

    // Click first product button (has $ price)
    const productBtn = page.locator('button').filter({ hasText: /\$/ }).first()
    await expect(productBtn).toBeVisible({ timeout: 8000 })
    await productBtn.click()
    await page.waitForTimeout(200)

    // Cart has item when cobrar button becomes enabled
    const cobrarBtn = page.locator('button').filter({ hasText: /cobrar/i })
    await expect(cobrarBtn).toBeEnabled({ timeout: 3000 })

    // Open payment modal
    await cobrarBtn.click()

    // Select first available payment method in modal
    const metodoBtn = page.locator('button').filter({ hasText: /efectivo|tarjeta|transferencia/i }).first()
    await expect(metodoBtn).toBeVisible({ timeout: 3000 })
    await metodoBtn.click()
    await page.waitForTimeout(200)

    // Confirm sale
    await page.locator('button').filter({ hasText: /confirmar/i }).click()

    await expect(page.locator('text=/registrada|cambio/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('stock se decrementó en la base', async () => {
    const admin = adminSupabase()
    const { data } = await admin.from('productos').select('existencias').eq('id', productoId).single()
    expect(data!.existencias).toBeLessThan(stockAntes)
  })
})
