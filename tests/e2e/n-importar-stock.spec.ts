import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { adminSupabase, userSupabase } from '../helpers/supa'
import { TEST_DUENO } from '../global-setup'

const STORAGE = path.join(__dirname, '../.auth/dueno.json')
const FIXTURE = path.join(__dirname, '../.auth/fixture.json')
test.use({ storageState: STORAGE })

/**
 * El importador de catálogo guardaba productos.existencias sin crear lote.
 * Como registrar_venta consume por lotes, esos productos mostraban stock en
 * pantalla y reventaban al cobrar. Esta suite cubre el camino completo:
 * importar → tener lote → poder cobrar.
 */
test.describe('Importar catálogo: el stock importado se puede cobrar', () => {
  const admin = adminSupabase()
  let negocioId: string
  const PRODUCTO = `QA Import ${Date.now()}`
  let csvPath: string
  let productoId: string

  test.beforeAll(async () => {
    negocioId = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')).negocioId
    csvPath = path.join(os.tmpdir(), `qa-import-${Date.now()}.csv`)
    fs.writeFileSync(csvPath, `nombre,precio,costo,stock\n${PRODUCTO},25.50,18.00,7\n`)
  })

  test.afterAll(async () => {
    if (productoId) {
      await admin.from('venta_lotes').delete().in('lote_id',
        ((await admin.from('lotes_producto').select('id').eq('producto_id', productoId)).data ?? []).map((l) => l.id))
      await admin.from('lotes_producto').delete().eq('producto_id', productoId)
      await admin.from('productos').delete().eq('id', productoId)
    }
    fs.rmSync(csvPath, { force: true })
  })

  test('importar un CSV con stock crea el lote correspondiente', async ({ page }) => {
    await page.goto('/productos/importar')
    await expect(page).not.toHaveURL(/login/)

    await page.setInputFiles('input[type="file"]', csvPath)
    await page.getByRole('button', { name: /Importar 1 producto/i }).click()
    await expect(page.getByText(/Importación completada/i)).toBeVisible({ timeout: 20000 })

    const { data: prod } = await admin
      .from('productos').select('id, existencias')
      .eq('negocio_id', negocioId).eq('nombre', PRODUCTO).single()
    productoId = prod!.id
    expect(Number(prod!.existencias)).toBe(7)

    // Lo que faltaba antes: el lote que respalda esas existencias
    const { data: lotes } = await admin
      .from('lotes_producto').select('cantidad_actual, local_id')
      .eq('producto_id', productoId).eq('activo', true)
    expect(lotes).toHaveLength(1)
    expect(Number(lotes![0].cantidad_actual)).toBe(7)
    expect(lotes![0].local_id).toBeNull() // pool global, sin plaza
  })

  test('el producto importado se puede cobrar sin error de lotes', async () => {
    const { data: metodos } = await admin
      .from('metodos_pago').select('id').eq('negocio_id', negocioId).limit(1)

    // La venta va como el dueño: registrar_venta valida membresía con auth.uid()
    const dueno = await userSupabase(TEST_DUENO.email, TEST_DUENO.password)
    const { error } = await dueno.rpc('registrar_venta', {
      p_negocio_id: negocioId,
      p_items: [{ producto_id: productoId, cantidad: 2 }],
      p_metodo_pago_id: metodos![0].id,
      p_pago_recibido: 10000,
    })
    // Antes del arreglo: "Inconsistencia de stock por lotes"
    expect(error).toBeNull()

    const { data: prod } = await admin
      .from('productos').select('existencias').eq('id', productoId).single()
    expect(Number(prod!.existencias)).toBe(5)
  })
})
