import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { adminSupabase } from '../helpers/supa'

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
