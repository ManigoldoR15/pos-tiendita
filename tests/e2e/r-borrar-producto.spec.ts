import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { adminSupabase } from '../helpers/supa'

const STORAGE = path.join(__dirname, '../.auth/dueno.json')
const FIXTURE = path.join(__dirname, '../.auth/fixture.json')
test.use({ storageState: STORAGE })

/**
 * El ✕ de la lista de productos pide confirmación, y si el producto ya tiene
 * ventas no se puede borrar: antes fallaba sin decir nada (Rubén lo intentó
 * 8 veces el 16-sep). Ahora avisa y ofrece ocultarlo.
 */
test.describe('Borrar producto desde la lista', () => {
  const admin = adminSupabase()
  const sufijo = Date.now()
  const LIBRE = `QA Borrable ${sufijo}`
  const VENDIDO = `QA Vendido ${sufijo}`
  let negocioId: string
  let vendidoId: string
  let ventaId: string

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('_gps_no', String(Date.now())) } catch {}
    })
  })

  test.beforeAll(async () => {
    negocioId = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')).negocioId
    const { data: productos, error } = await admin.from('productos').insert([
      { negocio_id: negocioId, nombre: LIBRE, precio_venta: 1000, existencias: 0 },
      { negocio_id: negocioId, nombre: VENDIDO, precio_venta: 1500, existencias: 0 },
    ]).select('id, nombre')
    if (error) throw error
    vendidoId = productos!.find((p) => p.nombre === VENDIDO)!.id

    const { data: metodo } = await admin.from('metodos_pago').select('id')
      .eq('negocio_id', negocioId).limit(1).single()
    const { data: venta, error: errVenta } = await admin.from('ventas')
      .insert({ negocio_id: negocioId, metodo_pago_id: metodo!.id, total: 1500 })
      .select('id').single()
    if (errVenta) throw errVenta
    ventaId = venta!.id
    const { error: errItem } = await admin.from('venta_items').insert({
      venta_id: ventaId, producto_id: vendidoId, cantidad: 1, precio_unitario: 1500, subtotal: 1500,
    })
    if (errItem) throw errItem
  })

  test.afterAll(async () => {
    await admin.from('venta_items').delete().eq('venta_id', ventaId)
    await admin.from('ventas').delete().eq('id', ventaId)
    await admin.from('productos').delete().eq('negocio_id', negocioId).in('nombre', [LIBRE, VENDIDO])
  })

  async function producto(nombre: string) {
    const { data } = await admin.from('productos').select('id, activo')
      .eq('negocio_id', negocioId).eq('nombre', nombre).maybeSingle()
    return data
  }

  function tarjeta(page: import('@playwright/test').Page, nombre: string) {
    return page.locator('div.card-soft').filter({ has: page.getByText(nombre, { exact: true }) })
  }

  test('cancelar la confirmación no borra; aceptarla sí', async ({ page }) => {
    await page.goto(`/productos?q=${encodeURIComponent(LIBRE)}`)
    const boton = tarjeta(page, LIBRE).getByTitle('Borrar producto')

    page.once('dialog', (d) => {
      expect(d.message()).toBe(`¿Borrar "${LIBRE}"? No se puede deshacer.`)
      d.dismiss()
    })
    await boton.click()
    await page.waitForTimeout(1000)
    expect(await producto(LIBRE)).not.toBeNull()

    page.once('dialog', (d) => d.accept())
    await boton.click()
    await expect.poll(() => producto(LIBRE)).toBeNull()
    await expect(page.getByText(LIBRE, { exact: true })).toHaveCount(0)
  })

  test('un producto con ventas avisa y se puede ocultar', async ({ page }) => {
    await page.goto(`/productos?q=${encodeURIComponent(VENDIDO)}`)
    const card = tarjeta(page, VENDIDO)

    page.once('dialog', (d) => d.accept())
    await card.getByTitle('Borrar producto').click()

    const aviso = card.getByRole('alert')
    await expect(aviso).toHaveText(/Este producto ya tiene ventas y no se puede borrar\./)
    expect(await producto(VENDIDO)).toMatchObject({ id: vendidoId, activo: true })

    await aviso.getByRole('button', { name: 'Ocultar producto' }).click()
    await expect(aviso).toHaveCount(0)
    await expect.poll(async () => (await producto(VENDIDO))?.activo).toBe(false)
  })
})
