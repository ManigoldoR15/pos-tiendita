import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { adminSupabase } from '../helpers/supa'

const STORAGE = path.join(__dirname, '../.auth/dueno.json')
const FIXTURE = path.join(__dirname, '../.auth/fixture.json')
test.use({ storageState: STORAGE })

/**
 * Multi-plaza: inventario separado por plaza, transferencias entre plazas y
 * stock de la plaza en el POS. Hasta esta suite el módulo no tenía cobertura:
 * todos los demás specs venden con p_local_id = null.
 */
test.describe('Multi-plaza: inventario, transferencias y POS por plaza', () => {
  const admin = adminSupabase()
  let negocioId: string
  let duenoId: string
  let plazaA: string
  let plazaB: string
  let productoId: string
  let localPrevioDueno: string | null = null

  const PRODUCTO = `QA Plaza ${Date.now()}`

  test.beforeAll(async () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    negocioId = fixture.negocioId
    duenoId = fixture.duenoId

    // El negocio de pruebas ya tiene plazas; si no, se crean para esta suite
    await admin.from('negocios').update({ max_plazas: 3 }).eq('id', negocioId)
    const { data: existentes } = await admin
      .from('locales').select('id, nombre').eq('negocio_id', negocioId).eq('activo', true).order('created_at')

    const plazas = existentes ?? []
    for (const nombre of ['QA Plaza Uno', 'QA Plaza Dos']) {
      if (plazas.length >= 2) break
      const { data } = await admin
        .from('locales').insert({ negocio_id: negocioId, nombre, activo: true }).select('id, nombre').single()
      if (data) plazas.push(data)
    }
    plazaA = plazas[0].id
    plazaB = plazas[1].id

    // Producto propio de esta suite con stock repartido: 12 en A, 7 en B
    const { data: prod } = await admin.from('productos').insert({
      negocio_id: negocioId, nombre: PRODUCTO, precio_venta: 2500, precio_costo: 1500,
      existencias: 0, unidad_medida: 'pieza', activo: true,
    }).select('id').single()
    productoId = prod!.id

    const hoy = new Date().toISOString().slice(0, 10)
    await admin.from('lotes_producto').insert([
      { negocio_id: negocioId, producto_id: productoId, cantidad: 12, cantidad_actual: 12, fecha_recepcion: hoy, ubicacion: 'ambiente', local_id: plazaA, activo: true },
      { negocio_id: negocioId, producto_id: productoId, cantidad: 7, cantidad_actual: 7, fecha_recepcion: hoy, ubicacion: 'ambiente', local_id: plazaB, activo: true },
    ])

    const { data: miembro } = await admin
      .from('usuarios_negocio').select('local_id')
      .eq('negocio_id', negocioId).eq('user_id', duenoId).maybeSingle()
    localPrevioDueno = miembro?.local_id ?? null
  })

  test.afterAll(async () => {
    // Dejar el negocio de pruebas como estaba: el resto de la suite vende sin plaza
    await admin.from('usuarios_negocio').update({ local_id: localPrevioDueno })
      .eq('negocio_id', negocioId).eq('user_id', duenoId)
    await admin.from('transferencias_inventario').delete().eq('producto_id', productoId)
    await admin.from('lotes_producto').delete().eq('producto_id', productoId)
    await admin.from('productos').delete().eq('id', productoId)
  })

  test('/plazas/stock muestra el inventario separado por plaza', async ({ page }) => {
    await page.goto('/plazas/stock')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.getByRole('heading', { name: /Inventario por plaza/i })).toBeVisible()
    // El producto aparece con su cantidad en cada plaza
    await expect(page.getByText(PRODUCTO).first()).toBeVisible()
    await expect(page.getByText('12 pz').first()).toBeVisible()
    await expect(page.getByText('7 pz').first()).toBeVisible()
  })

  test('transferir stock de una plaza a otra desde la pantalla', async ({ page }) => {
    await page.goto('/plazas/stock')
    await page.getByRole('button', { name: /Transferir stock entre plazas/i }).click()

    await page.selectOption('select[name="linea"]', `${productoId}|`)
    await page.selectOption('select[name="desde"]', plazaA)
    await page.selectOption('select[name="hacia"]', plazaB)
    await page.fill('input[name="cantidad"]', '4')
    await page.getByRole('button', { name: /^Transferir$/ }).click()

    await expect(page.getByText(/Stock transferido/i)).toBeVisible({ timeout: 15000 })

    // La verdad está en la base: 12-4 = 8 en A, 7+4 = 11 en B
    const stockEn = async (localId: string) => {
      const { data } = await admin.from('lotes_producto')
        .select('cantidad_actual').eq('producto_id', productoId).eq('local_id', localId).eq('activo', true)
      return (data ?? []).reduce((s, l) => s + Number(l.cantidad_actual), 0)
    }
    expect(await stockEn(plazaA)).toBe(8)
    expect(await stockEn(plazaB)).toBe(11)

    // Y dejó rastro en la bitácora
    const { data: audit } = await admin.from('transferencias_inventario')
      .select('cantidad, from_local_id, to_local_id').eq('producto_id', productoId)
    expect(audit).toHaveLength(1)
    expect(Number(audit![0].cantidad)).toBe(4)
    expect(audit![0].from_local_id).toBe(plazaA)
    expect(audit![0].to_local_id).toBe(plazaB)
  })

  test('el total del negocio no cambia al mover stock entre plazas', async () => {
    const { data } = await admin.from('productos').select('existencias').eq('id', productoId).single()
    expect(Number(data!.existencias)).toBe(19) // 12 + 7, solo cambió de plaza
  })

  test('/productos desglosa el stock por plaza', async ({ page }) => {
    await page.goto(`/productos?q=${encodeURIComponent(PRODUCTO)}`)
    await expect(page.getByText(PRODUCTO).first()).toBeVisible()
    await expect(page.getByText(/Stock: 19/).first()).toBeVisible()
    // Chips con el reparto: la suma de las dos plazas
    const chips = page.locator('span[title$="pz"], span[title*=" en "]')
    await expect(chips.first()).toBeVisible()
  })

  test('el POS muestra el stock de la plaza del vendedor, no el global', async ({ page }) => {
    // Con el dueño asignado a la plaza A debe ver 8, no 19
    await admin.from('usuarios_negocio').update({ local_id: plazaA })
      .eq('negocio_id', negocioId).eq('user_id', duenoId)

    await page.goto('/pos')
    await expect(page.getByText(/el stock que ves es el de esta plaza/i)).toBeVisible()

    const tarjeta = page.locator('button', { hasText: PRODUCTO }).first()
    await expect(tarjeta).toBeVisible()
    // Sobre el texto del stock, no sobre todo el botón: el nombre lleva un
    // timestamp que puede contener el número que se está descartando.
    await expect(tarjeta).toContainText('8 disp.')
    await expect(tarjeta).not.toContainText('19 disp.')
  })

  test('sin plaza asignada el POS sigue mostrando el total del negocio', async ({ page }) => {
    await admin.from('usuarios_negocio').update({ local_id: null })
      .eq('negocio_id', negocioId).eq('user_id', duenoId)

    await page.goto('/pos')
    await expect(page.getByText(/el stock que ves es el de esta plaza/i)).toHaveCount(0)

    const tarjeta = page.locator('button', { hasText: PRODUCTO }).first()
    await expect(tarjeta).toBeVisible()
    await expect(tarjeta).toContainText('19 disp.')
  })
})
