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
  let duenoId: string
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
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    negocioId = fixture.negocioId
    duenoId = fixture.duenoId

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

  test('el POS de una plaza vacía explica que la mercancía está en otro lado', async ({ page }) => {
    // Producto con stock solo en plazaB: desde plazaA debe verse "Agotado aquí"
    const { data: prod } = await admin.from('productos').insert({
      negocio_id: negocioId, nombre: `${PRODUCTO} solo en B`, precio_venta: 1000,
      existencias: 0, unidad_medida: 'pieza', activo: true,
    }).select('id').single()
    creados.push(prod!.id)
    await admin.from('lotes_producto').insert({
      negocio_id: negocioId, producto_id: prod!.id, cantidad: 9, cantidad_actual: 9,
      fecha_recepcion: new Date().toISOString().slice(0, 10), ubicacion: 'ambiente',
      local_id: plazaB, activo: true,
    })

    const { data: prev } = await admin.from('usuarios_negocio').select('local_id')
      .eq('negocio_id', negocioId).eq('user_id', duenoId).maybeSingle()
    await admin.from('usuarios_negocio').update({ local_id: plazaA })
      .eq('negocio_id', negocioId).eq('user_id', duenoId)

    try {
      await page.goto('/pos')
      const tarjeta = page.locator('button', { hasText: `${PRODUCTO} solo en B` }).first()
      await expect(tarjeta).toContainText('Agotado aquí')
      await expect(tarjeta).toContainText('9 en otra plaza')
    } finally {
      await admin.from('usuarios_negocio').update({ local_id: prev?.local_id ?? null })
        .eq('negocio_id', negocioId).eq('user_id', duenoId)
    }
  })

  test('la plaza vacía ofrece traer mercancía y abre la transferencia apuntada ahí', async ({ page }) => {
    // plazaB tiene stock en este punto; se usa una plaza recién creada y vacía
    const { data: vacia } = await admin.from('locales')
      .insert({ negocio_id: negocioId, nombre: 'QA Plaza Vacía', activo: true })
      .select('id').single()

    try {
      await page.goto(`/plazas/${vacia!.id}`)
      await page.getByRole('link', { name: /Traer mercancía del general/i }).click()

      await expect(page).toHaveURL(new RegExp(`/plazas/stock\\?hacia=${vacia!.id}`))
      // El formulario ya viene abierto y con el destino puesto
      await expect(page.locator('select[name="hacia"]')).toHaveValue(vacia!.id)
    } finally {
      await admin.from('locales').delete().eq('id', vacia!.id)
    }
  })

  test('transferir DESDE el general deja capturar la cantidad y mueve el stock', async ({ page }) => {
    // El caso más común y el que estaba roto: el pool global usa '' como id y
    // el placeholder del select valía '' también, así que elegir "General"
    // contaba como "no elegí nada" y el campo de cantidad quedaba bloqueado.
    const nombre = `${PRODUCTO} en general`
    const { data: prod } = await admin.from('productos').insert({
      negocio_id: negocioId, nombre, precio_venta: 1000,
      existencias: 0, unidad_medida: 'pieza', activo: true,
    }).select('id').single()
    creados.push(prod!.id)
    await admin.from('lotes_producto').insert({
      negocio_id: negocioId, producto_id: prod!.id, cantidad: 10, cantidad_actual: 10,
      fecha_recepcion: new Date().toISOString().slice(0, 10), ubicacion: 'ambiente',
      local_id: null, activo: true, // nace en el general, como todo
    })

    await page.goto('/plazas/stock')
    await page.getByRole('button', { name: /Transferir stock entre plazas/i }).click()
    await page.selectOption('select[name="linea"]', `${prod!.id}|`)
    await page.selectOption('select[name="desde"]', '') // General (sin plaza)

    // Antes de la corrección este input seguía deshabilitado
    const cantidad = page.locator('input[name="cantidad"]')
    await expect(cantidad).toBeEnabled()
    await expect(page.getByText(/disponible: 10/)).toBeVisible()

    await page.selectOption('select[name="hacia"]', plazaA)
    await cantidad.fill('4')
    await page.getByRole('button', { name: /^Transferir$/ }).click()
    await expect(page.getByText(/Stock transferido/i)).toBeVisible({ timeout: 15000 })

    const { data: lotes } = await admin
      .from('lotes_producto').select('local_id, cantidad_actual')
      .eq('producto_id', prod!.id).eq('activo', true).gt('cantidad_actual', 0)
    const enPlaza = (lotes ?? []).filter((l) => l.local_id === plazaA)
      .reduce((s, l) => s + Number(l.cantidad_actual), 0)
    const enGeneral = (lotes ?? []).filter((l) => l.local_id === null)
      .reduce((s, l) => s + Number(l.cantidad_actual), 0)
    expect(enPlaza).toBe(4)
    expect(enGeneral).toBe(6)
  })

  test('el reporte de inventario desglosa dónde está el stock', async ({ page }) => {
    await page.goto('/reportes/inventario')
    await expect(page.getByRole('heading', { name: /Dónde está este inventario/i })).toBeVisible()
    // Aparece el general y al menos una plaza con stock
    await expect(page.getByText('General (sin plaza)').first()).toBeVisible()
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
