import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { adminSupabase } from '../helpers/supa'

const STORAGE = path.join(__dirname, '../.auth/dueno.json')
const FIXTURE = path.join(__dirname, '../.auth/fixture.json')
test.use({ storageState: STORAGE })

/**
 * Sin caja abierta la venta se guarda pero no entra a ningún corte. El POS no
 * bloquea el cobro, pero tiene que avisarlo en los dos modos.
 */
test.describe('POS: aviso de caja cerrada', () => {
  const admin = adminSupabase()
  let negocioId: string
  let duenoId: string
  let corteId: string | null = null

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('_gps_no', String(Date.now())) } catch {}
    })
  })

  test.beforeAll(async () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    negocioId = fixture.negocioId
    duenoId = fixture.duenoId
    await admin
      .from('cortes_caja')
      .update({ estado: 'cerrado', fecha_cierre: new Date().toISOString(), monto_contado: 0, diferencia: 0, monto_esperado: 0 })
      .eq('negocio_id', negocioId)
      .eq('estado', 'abierto')
  })

  test.afterAll(async () => {
    if (corteId) await admin.from('cortes_caja').delete().eq('id', corteId)
  })

  test('sin caja avisa en táctil y mostrador; con caja el aviso desaparece', async ({ page }) => {
    const aviso = page.getByRole('alert').filter({ hasText: 'No hay caja abierta.' })

    await page.goto('/pos')
    await expect(aviso).toBeVisible()
    await expect(aviso.getByRole('link', { name: 'Abrir caja' })).toHaveAttribute('href', '/corte')

    await page.getByRole('button', { name: 'Mostrador' }).click()
    await expect(aviso).toBeVisible()

    const { data, error } = await admin.from('cortes_caja').insert({
      negocio_id: negocioId, abierto_por: duenoId, monto_inicial: 0, estado: 'abierto', local_id: null,
    }).select('id').single()
    if (error) throw error
    corteId = data!.id

    await page.goto('/pos')
    await expect(page.getByRole('button', { name: 'Mostrador' })).toBeVisible()
    await expect(aviso).toHaveCount(0)
  })
})
