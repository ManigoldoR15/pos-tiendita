/**
 * Test c: POS Modo Mostrador — agregar por código de barras tecleado, F2, cobro
 */
import { test, expect } from '@playwright/test'
import * as path from 'path'
import { TEST_BARCODE } from '../global-setup'

const STORAGE = path.join(__dirname, '../.auth/dueno.json')
test.use({ storageState: STORAGE })

test.describe('Venta mostrador: escáner de código de barras', () => {
  test('cambiar a modo mostrador', async ({ page }) => {
    await page.goto('/pos')
    await page.waitForLoadState('networkidle')

    const mostrador = page.locator('button').filter({ hasText: /mostrador/i })
    await expect(mostrador).toBeVisible({ timeout: 5000 })
    await mostrador.click()

    // Scanner input should appear
    const scanInput = page.locator('input[placeholder*="barras"], input[placeholder*="código"]')
    await expect(scanInput).toBeVisible({ timeout: 3000 })
  })

  test('agregar producto por código de barras y cobrar con F2', async ({ page }) => {
    await page.goto('/pos')
    await page.waitForLoadState('networkidle')

    // Switch to mostrador
    const mostrador = page.locator('button').filter({ hasText: /mostrador/i })
    await mostrador.click()
    await page.waitForTimeout(300)

    // Type barcode in scanner input
    const scanInput = page.locator('input[placeholder*="barras"], input[placeholder*="código"]')
    await expect(scanInput).toBeVisible({ timeout: 5000 })
    await scanInput.fill(TEST_BARCODE)
    await scanInput.press('Enter')
    await page.waitForTimeout(300)

    // Product should appear in ticket
    const ticketRow = page.locator('table tbody tr')
    await expect(ticketRow).toHaveCount(1, { timeout: 3000 })

    // Set payment
    const pagoInput = page.locator('input[type="number"][min]').last()
    if (await pagoInput.count() > 0) {
      await pagoInput.fill('100')
    }

    // Press F2 to pay
    await page.keyboard.press('F2')

    // Expect success
    await expect(
      page.locator('text=/registrada|Venta registrada/i')
    ).toBeVisible({ timeout: 10000 })
  })

  test('Esc elimina el último item del ticket', async ({ page }) => {
    await page.goto('/pos')
    await page.waitForLoadState('networkidle')

    // Switch to mostrador
    await page.locator('button').filter({ hasText: /mostrador/i }).click()
    await page.waitForTimeout(300)

    // Add item
    const scanInput = page.locator('input[placeholder*="barras"], input[placeholder*="código"]')
    await scanInput.fill(TEST_BARCODE)
    await scanInput.press('Enter')
    await page.waitForTimeout(200)

    const rowsBefore = await page.locator('table tbody tr').count()
    expect(rowsBefore).toBeGreaterThan(0)

    // Press Esc to remove last item
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    const rowsAfter = await page.locator('table tbody tr').count()
    expect(rowsAfter).toBeLessThan(rowsBefore)
  })
})
