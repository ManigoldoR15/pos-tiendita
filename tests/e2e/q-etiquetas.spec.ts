import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { adminSupabase } from '../helpers/supa'

const STORAGE = path.join(__dirname, '../.auth/dueno.json')
const FIXTURE = path.join(__dirname, '../.auth/fixture.json')
test.use({ storageState: STORAGE })

/**
 * Etiquetas enlista solo los productos marcados con "Le imprimo etiqueta"
 * (migración 086). Los que traen código de fábrica nacen desmarcados.
 */
test.describe('Etiquetas: solo los productos marcados', () => {
  const admin = adminSupabase()
  const sufijo = Date.now()
  const CON = `QA Queso etiqueta ${sufijo}`
  const SIN = `QA Refresco fabrica ${sufijo}`
  let negocioId: string
  const ids: string[] = []

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('_gps_no', String(Date.now())) } catch {}
    })
  })

  test.beforeAll(async () => {
    negocioId = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')).negocioId
    const { data, error } = await admin.from('productos').insert([
      { negocio_id: negocioId, nombre: CON, precio_venta: 5000, existencias: 0 },
      { negocio_id: negocioId, nombre: SIN, precio_venta: 1800, existencias: 0, codigo_barras: `750${sufijo}`.slice(0, 13) },
    ]).select('id, nombre, lleva_etiqueta')
    if (error) throw error
    ids.push(...data!.map((p) => p.id))
    // El trigger decide por el código: sin código lleva, con código comercial no
    expect(data!.find((p) => p.nombre === CON)!.lleva_etiqueta).toBe(true)
    expect(data!.find((p) => p.nombre === SIN)!.lleva_etiqueta).toBe(false)
  })

  test.afterAll(async () => {
    if (ids.length) await admin.from('productos').delete().in('id', ids)
  })

  async function llevaEtiqueta(nombre: string) {
    const { data } = await admin.from('productos').select('lleva_etiqueta')
      .eq('negocio_id', negocioId).eq('nombre', nombre).single()
    return data!.lleva_etiqueta
  }

  test('la pestaña "Con etiqueta" oculta los de fábrica y "Todos" permite marcarlos', async ({ page }) => {
    await page.goto('/productos/etiquetas')
    const buscador = page.getByPlaceholder('Buscar producto…')

    await buscador.fill(String(sufijo))
    await expect(page.getByText(CON, { exact: true })).toBeVisible()
    await expect(page.getByText(SIN, { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: /^Todos \(/ }).click()
    await expect(page.getByText(SIN, { exact: true })).toBeVisible()

    const sw = page.getByRole('switch', { name: `Le imprimo etiqueta a ${SIN}` })
    await expect(sw).toHaveAttribute('aria-checked', 'false')
    await sw.click()
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    await expect.poll(() => llevaEtiqueta(SIN)).toBe(true)

    // De vuelta en "Con etiqueta" ya sale, y se puede generar su etiqueta
    await page.getByRole('button', { name: /^Con etiqueta \(/ }).click()
    await expect(page.getByText(SIN, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Poner 1 a cada uno' }).click()
    await expect(page.getByRole('button', { name: 'Generar 2 etiquetas' })).toBeVisible()

    // Apagar uno lo deja atenuado (no desaparece al instante) y lo guarda
    await page.getByRole('switch', { name: `Le imprimo etiqueta a ${CON}` }).click()
    await expect(page.getByText(CON, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Generar 1 etiqueta' })).toBeVisible()
    await expect.poll(() => llevaEtiqueta(CON)).toBe(false)
  })

  test('el interruptor de la ficha del producto se guarda', async ({ page }) => {
    const { data } = await admin.from('productos').select('id, lleva_etiqueta')
      .eq('negocio_id', negocioId).eq('nombre', SIN).single()
    await page.goto(`/productos/${data!.id}/editar`)
    const sw = page.getByRole('switch', { name: 'Le imprimo etiqueta' })
    await expect(sw).toHaveAttribute('aria-checked', String(data!.lleva_etiqueta))
    await sw.click()
    await page.getByRole('button', { name: 'Guardar producto' }).click()
    await page.waitForURL(/\/productos$/)
    await expect.poll(() => llevaEtiqueta(SIN)).toBe(!data!.lleva_etiqueta)
  })
})
