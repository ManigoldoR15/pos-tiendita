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
  let productoNombre: string
  let stockAntes: number

  test.beforeAll(async () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    negocioId = fixture.negocioId
    const admin = adminSupabase()
    const { data } = await admin
      .from('productos')
      .select('id, existencias, nombre')
      .eq('negocio_id', negocioId)
      .eq('activo', true)
      .gt('existencias', 2)
      .eq('unidad_medida', 'pieza')
      .order('nombre')
      .limit(1)
      .single()
    if (!data) throw new Error('No hay producto con stock > 2 para la prueba')
    productoId = data.id
    productoNombre = data.nombre
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

    // Click the exact product tracked in beforeAll
    const productBtn = page.locator('button').filter({ hasText: productoNombre }).first()
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

test.describe('Cobro rápido: billetes comunes y tope de granel', () => {
  const admin = adminSupabase()
  let negocioId: string
  let productoNombre: string
  let granelId: string
  const GRANEL = `QA Granel ${Date.now()}`

  test.beforeAll(async () => {
    negocioId = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')).negocioId

    const { data } = await admin
      .from('productos').select('nombre')
      .eq('negocio_id', negocioId).eq('activo', true)
      .gt('existencias', 2).eq('unidad_medida', 'pieza')
      .order('nombre').limit(1).single()
    productoNombre = data!.nombre

    // Producto a granel con exactamente 2 kg, para probar el tope del carrito
    const { data: g } = await admin.from('productos').insert({
      negocio_id: negocioId, nombre: GRANEL, precio_venta: 5000,
      existencias: 0, unidad_medida: 'kg', activo: true,
    }).select('id').single()
    granelId = g!.id
    await admin.from('lotes_producto').insert({
      negocio_id: negocioId, producto_id: granelId, cantidad: 2, cantidad_actual: 2,
      fecha_recepcion: new Date().toISOString().slice(0, 10), ubicacion: 'ambiente', activo: true,
    })
  })

  test.afterAll(async () => {
    await admin.from('lotes_producto').delete().eq('producto_id', granelId)
    await admin.from('productos').delete().eq('id', granelId)
  })

  test('el botón Exacto llena el pago y el cambio queda en cero', async ({ page }) => {
    await page.goto('/pos')
    await page.locator('button').filter({ hasText: productoNombre }).first().click()
    await page.locator('button').filter({ hasText: /^Cobrar \$/ }).click()

    // Efectivo es el método por default; los billetes están a un toque
    await page.getByRole('button', { name: 'Exacto' }).click()
    await expect(page.getByText('Cambio')).toBeVisible()
    await expect(page.getByText('$0.00').first()).toBeVisible()

    // Un billete pone su monto tal cual en el campo
    const b500 = page.getByRole('button', { name: '$500' })
    await expect(b500).toBeEnabled()
    await b500.click()
    await expect(page.locator('input[placeholder="0.00"]').first()).toHaveValue('500')

    await page.getByRole('button', { name: 'Cancelar' }).click()
  })

  test('granel: pedir más de lo que hay lo topa al stock y avisa', async ({ page }) => {
    await page.goto('/pos')
    await page.locator('button').filter({ hasText: GRANEL }).first().click()

    // Modal de granel: pedir 5 kg cuando solo hay 2
    const cantidad = page.locator('input[placeholder="0"]')
    await expect(cantidad).toBeVisible()
    await cantidad.fill('5')
    await page.getByRole('button', { name: 'Agregar' }).click()

    // Avisa y deja el carrito en el máximo real, no en lo pedido
    await expect(page.getByText(/Solo quedan 2/)).toBeVisible()
    await expect(page.locator('input[type="number"][step="0.001"], input[type="number"][step="0.01"]').first())
      .toHaveValue('2')
  })
})
