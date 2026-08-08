import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { adminSupabase } from '../helpers/supa'

const STORAGE = path.join(__dirname, '../.auth/dueno.json')
const FIXTURE = path.join(__dirname, '../.auth/fixture.json')
test.use({ storageState: STORAGE })

/**
 * Dar de alta stock nuevo directamente en una plaza. Antes todo el inventario
 * nacía en el general (sin plaza) y había que transferirlo: el alta de producto
 * y el importador insertaban el lote sin local_id, y la pantalla de la plaza no
 * ofrecía ninguna entrada de mercancía.
 */
test.describe('Alta de stock directo en una plaza', () => {
  const admin = adminSupabase()
  let negocioId: string
  let plazaA: string
  let plazaB: string
  let nombrePlazaA: string

  const PRODUCTO = `QA Alta Plaza ${Date.now()}`
  const IMPORTADO = `QA Import Plaza ${Date.now()}`
  let csvPath: string
  const creados: string[] = []

  // El aviso de GPS es un toast fijo abajo a la derecha que tapa los botones de
  // acción de estas pantallas. Se marca como rechazado antes de cargar la página.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('_gps_no', String(Date.now())) } catch {}
    })
  })

  test.beforeAll(async () => {
    negocioId = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')).negocioId

    // El selector de plaza solo aparece con dos o más: se reutilizan las del
    // negocio de pruebas y se completan si hiciera falta.
    await admin.from('negocios').update({ max_plazas: 3 }).eq('id', negocioId)
    const { data: existentes } = await admin
      .from('locales').select('id, nombre')
      .eq('negocio_id', negocioId).eq('activo', true).order('created_at')

    const plazas = existentes ?? []
    for (const nombre of ['QA Plaza Uno', 'QA Plaza Dos']) {
      if (plazas.length >= 2) break
      const { data } = await admin
        .from('locales').insert({ negocio_id: negocioId, nombre, activo: true })
        .select('id, nombre').single()
      if (data) plazas.push(data)
    }
    plazaA = plazas[0].id
    nombrePlazaA = plazas[0].nombre
    plazaB = plazas[1].id

    csvPath = path.join(os.tmpdir(), `qa-import-plaza-${Date.now()}.csv`)
    fs.writeFileSync(csvPath, `nombre,precio,costo,stock\n${IMPORTADO},31.00,20.00,9\n`)
  })

  test.afterAll(async () => {
    for (const id of creados) {
      await admin.from('lotes_producto').delete().eq('producto_id', id)
      await admin.from('productos').delete().eq('id', id)
    }
    fs.rmSync(csvPath, { force: true })
  })

  test('alta de producto: el lote inicial nace en la plaza elegida', async ({ page }) => {
    await page.goto('/productos/nuevo')
    await expect(page).not.toHaveURL(/login/)

    await page.fill('input[name="nombre"]', PRODUCTO)
    await page.fill('input[name="precio_venta"]', '30')
    await page.selectOption('select[name="local_id"]', plazaB)
    await page.fill('input[placeholder="Ej: 24"]', '5')

    await page.getByRole('button', { name: /Guardar producto/i }).click()
    await expect(page).toHaveURL(/\/productos(\?|$)/, { timeout: 20000 })

    const { data: prod } = await admin
      .from('productos').select('id, existencias')
      .eq('negocio_id', negocioId).eq('nombre', PRODUCTO).single()
    creados.push(prod!.id)
    expect(Number(prod!.existencias)).toBe(5)

    const { data: lotes } = await admin
      .from('lotes_producto').select('cantidad_actual, local_id')
      .eq('producto_id', prod!.id).eq('activo', true)
    expect(lotes).toHaveLength(1)
    expect(lotes![0].local_id).toBe(plazaB) // antes: null, siempre al general
    expect(Number(lotes![0].cantidad_actual)).toBe(5)
  })

  test('alta de producto sin elegir plaza sigue cayendo en el general', async ({ page }) => {
    const nombre = `${PRODUCTO} general`
    await page.goto('/productos/nuevo')
    await page.fill('input[name="nombre"]', nombre)
    await page.fill('input[name="precio_venta"]', '12')
    await page.fill('input[placeholder="Ej: 24"]', '3')
    await page.getByRole('button', { name: /Guardar producto/i }).click()
    await expect(page).toHaveURL(/\/productos(\?|$)/, { timeout: 20000 })

    const { data: prod } = await admin
      .from('productos').select('id').eq('negocio_id', negocioId).eq('nombre', nombre).single()
    creados.push(prod!.id)

    const { data: lotes } = await admin
      .from('lotes_producto').select('local_id').eq('producto_id', prod!.id).eq('activo', true)
    expect(lotes![0].local_id).toBeNull()
  })

  test('importador: el stock del archivo entra en la plaza elegida', async ({ page }) => {
    await page.goto('/productos/importar')
    await page.setInputFiles('input[type="file"]', csvPath)

    await page.selectOption('select[name="local_id"]', plazaA)
    await page.getByRole('button', { name: /Importar 1 producto/i }).click()
    await expect(page.getByText(/Importación completada/i)).toBeVisible({ timeout: 20000 })
    // El resumen dice a dónde entró
    await expect(page.getByText(new RegExp(`en ${nombrePlazaA}`, 'i'))).toBeVisible()

    const { data: prod } = await admin
      .from('productos').select('id').eq('negocio_id', negocioId).eq('nombre', IMPORTADO).single()
    creados.push(prod!.id)

    const { data: lotes } = await admin
      .from('lotes_producto').select('cantidad_actual, local_id')
      .eq('producto_id', prod!.id).eq('activo', true)
    expect(lotes).toHaveLength(1)
    expect(lotes![0].local_id).toBe(plazaA)
    expect(Number(lotes![0].cantidad_actual)).toBe(9)
  })

  test('desde la plaza, "Producto nuevo" da de alta con la plaza ya puesta', async ({ page }) => {
    const nombre = `${PRODUCTO} desde plaza`
    await page.goto(`/plazas/${plazaA}`)
    await page.getByRole('link', { name: /Producto nuevo/i }).click()

    await expect(page).toHaveURL(new RegExp(`/productos/nuevo\\?plaza=${plazaA}`))
    // El título dice a dónde va y el selector llega elegido: nada que recordar
    await expect(page.getByRole('heading', { name: new RegExp(`Nuevo producto en ${nombrePlazaA}`, 'i') })).toBeVisible()
    await expect(page.locator('select[name="local_id"]')).toHaveValue(plazaA)

    await page.fill('input[name="nombre"]', nombre)
    await page.fill('input[name="precio_venta"]', '18')
    await page.fill('input[placeholder="Ej: 24"]', '6')
    await page.getByRole('button', { name: /Guardar producto/i }).click()
    await expect(page).toHaveURL(/\/productos(\?|$)/, { timeout: 20000 })

    const { data: prod } = await admin
      .from('productos').select('id').eq('negocio_id', negocioId).eq('nombre', nombre).single()
    creados.push(prod!.id)

    const { data: lotes } = await admin
      .from('lotes_producto').select('cantidad_actual, local_id')
      .eq('producto_id', prod!.id).eq('activo', true)
    expect(lotes![0].local_id).toBe(plazaA)
    expect(Number(lotes![0].cantidad_actual)).toBe(6)
  })

  test('desde la plaza, "Agregar stock" abre la compra con esa plaza puesta', async ({ page }) => {
    await page.goto(`/plazas/${plazaA}`)
    await expect(page).not.toHaveURL(/login/)

    await page.getByRole('link', { name: /Agregar stock/i }).click()
    await expect(page).toHaveURL(new RegExp(`/compras/nueva\\?plaza=${plazaA}`))

    // La plaza llega preseleccionada: el dueño solo captura la mercancía
    await expect(page.locator('select[name="local_id"]')).toHaveValue(plazaA)
  })

  test('un local_id de otro negocio no se guarda en el lote', async ({ page }) => {
    const nombre = `${PRODUCTO} ajeno`
    await page.goto('/productos/nuevo')
    await page.fill('input[name="nombre"]', nombre)
    await page.fill('input[name="precio_venta"]', '15')
    await page.fill('input[placeholder="Ej: 24"]', '2')

    // Se inyecta una opción con un uuid que no es de este negocio
    await page.evaluate(() => {
      const sel = document.querySelector('select[name="local_id"]') as HTMLSelectElement
      const opt = document.createElement('option')
      opt.value = '00000000-0000-0000-0000-0000000000ff'
      sel.appendChild(opt)
      sel.value = opt.value
    })

    await page.getByRole('button', { name: /Guardar producto/i }).click()
    await expect(page.getByText(/La plaza seleccionada no existe/i)).toBeVisible({ timeout: 20000 })

    const { data: prod } = await admin
      .from('productos').select('id').eq('negocio_id', negocioId).eq('nombre', nombre).maybeSingle()
    if (prod) creados.push(prod.id) // no debería llegar a crearse con lote ajeno
  })
})
