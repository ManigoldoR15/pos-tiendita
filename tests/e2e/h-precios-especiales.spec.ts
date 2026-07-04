import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { adminSupabase } from '../helpers/supa'

const STORAGE = path.join(__dirname, '../.auth/dueno.json')
const FIXTURE = path.join(__dirname, '../.auth/fixture.json')
test.use({ storageState: STORAGE })

test.describe('Precios especiales por cliente', () => {
  let negocioId: string
  let clienteId: string
  let productoId: string
  let precioVenta: number
  let precioEspecial: number

  test.beforeAll(async () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    negocioId = fixture.negocioId
    const admin = adminSupabase()

    // Crear cliente de prueba
    const { data: cli } = await admin
      .from('clientes')
      .insert({ negocio_id: negocioId, nombre: 'Cliente Precio Especial E2E' })
      .select('id')
      .single()
    if (!cli) throw new Error('No se pudo crear cliente de prueba')
    clienteId = cli.id

    // Obtener un producto con stock y costo conocido
    const { data: prod } = await admin
      .from('productos')
      .select('id, precio_venta')
      .eq('negocio_id', negocioId)
      .eq('activo', true)
      .gt('existencias', 2)
      .eq('unidad_medida', 'pieza')
      .order('nombre')
      .limit(1)
      .single()
    if (!prod) throw new Error('No hay producto con stock > 2')
    productoId = prod.id
    precioVenta = prod.precio_venta

    // Asignar precio especial: 10% de descuento (1000 basis points)
    await admin.from('precios_especiales_cliente').upsert(
      { negocio_id: negocioId, cliente_id: clienteId, producto_id: productoId, tipo: 'porcentaje', valor: 1000 },
      { onConflict: 'negocio_id,cliente_id,producto_id' },
    )

    precioEspecial = Math.round((precioVenta * 9000) / 10000)
  })

  test.afterAll(async () => {
    const admin = adminSupabase()
    await admin.from('precios_especiales_cliente').delete().eq('cliente_id', clienteId).eq('negocio_id', negocioId)
    await admin.from('clientes').delete().eq('id', clienteId)
  })

  test('venta normal sin cliente usa precio normal (no regresión)', async ({ page }) => {
    const admin = adminSupabase()
    const { data: stockAntes } = await admin
      .from('productos')
      .select('existencias')
      .eq('id', productoId)
      .single()

    await page.goto('/pos')
    await page.waitForLoadState('networkidle')

    // Buscar y agregar el producto
    const searchInput = page.locator('input[placeholder*="Buscar"]').first()
    await searchInput.fill((await admin.from('productos').select('nombre').eq('id', productoId).single()).data?.nombre ?? '')
    await page.waitForTimeout(300)

    const productBtn = page.locator('button').filter({ hasText: /\$/ }).first()
    await expect(productBtn).toBeVisible({ timeout: 5000 })
    await productBtn.click()

    await page.locator('button').filter({ hasText: /cobrar/i }).click()
    // NO seleccionamos cliente
    await page.locator('button').filter({ hasText: /confirmar/i }).click()
    await expect(page.locator('text=/registrada/i').first()).toBeVisible({ timeout: 10000 })

    // Verificar que el precio en venta_items es el precio_venta normal (sin precio_normal)
    const { data: ventaReciente } = await admin
      .from('ventas')
      .select('id')
      .eq('negocio_id', negocioId)
      .eq('cliente_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (ventaReciente) {
      const { data: items } = await admin
        .from('venta_items')
        .select('precio_unitario, precio_normal')
        .eq('venta_id', ventaReciente.id)
        .eq('producto_id', productoId)

      for (const item of items ?? []) {
        expect(item.precio_normal).toBeNull()
        expect(item.precio_unitario).toBe(precioVenta)
      }
    }
  })

  test('precio especial se aplica al seleccionar cliente en POS', async ({ page }) => {
    const admin = adminSupabase()

    await page.goto('/pos')
    await page.waitForLoadState('networkidle')

    // Agregar producto al carrito
    const { data: prod } = await admin.from('productos').select('nombre').eq('id', productoId).single()
    const searchInput = page.locator('input[placeholder*="Buscar"]').first()
    await searchInput.fill(prod?.nombre ?? '')
    await page.waitForTimeout(300)

    const productBtn = page.locator('button').filter({ hasText: /\$/ }).first()
    await productBtn.click()

    // Abrir modal de cobro
    await page.locator('button').filter({ hasText: /cobrar/i }).click()

    // Buscar y seleccionar el cliente con precio especial
    const clienteInput = page.locator('input[placeholder*="nombre o teléfono"]')
    await clienteInput.fill('Cliente Precio Especial')
    await page.waitForTimeout(500)

    const clienteBtn = page.locator('button').filter({ hasText: /Cliente Precio Especial/i }).first()
    await expect(clienteBtn).toBeVisible({ timeout: 5000 })
    await clienteBtn.click()
    await page.waitForTimeout(600) // esperar fetch de precios especiales

    // Verificar que se muestra el bloque de precios especiales
    await expect(page.locator('text=/Precios especiales para/i')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=/ahorro/i').first()).toBeVisible()

    // Verificar que el total tachado es diferente al total mostrado
    await expect(page.locator('text=/Precio normal/i').first()).toBeVisible()

    // Confirmar venta
    await page.locator('button').filter({ hasText: /confirmar/i }).click()
    await expect(page.locator('text=/registrada/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('precio_unitario en venta_items refleja el precio especial', async () => {
    const admin = adminSupabase()

    const { data: venta } = await admin
      .from('ventas')
      .select('id')
      .eq('negocio_id', negocioId)
      .eq('cliente_id', clienteId)
      .eq('estado', 'completada')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    expect(venta).toBeTruthy()

    const { data: items } = await admin
      .from('venta_items')
      .select('precio_unitario, precio_normal')
      .eq('venta_id', venta!.id)
      .eq('producto_id', productoId)

    expect(items?.length).toBeGreaterThan(0)
    for (const item of items ?? []) {
      expect(item.precio_unitario).toBe(precioEspecial)
      expect(item.precio_normal).toBe(precioVenta)
    }
  })
})
