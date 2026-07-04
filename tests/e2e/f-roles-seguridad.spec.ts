/**
 * Test f: SEGURIDAD DE ROLES — el más importante.
 * FALLO = hallazgo CRÍTICO de seguridad.
 */
import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { adminSupabase, userSupabase } from '../helpers/supa'
import { TEST_DUENO, TEST_EMPLEADO, TEST_ADMIN } from '../global-setup'

const AUTH_EMPLEADO = path.join(__dirname, '../.auth/empleado.json')
const AUTH_ADMIN    = path.join(__dirname, '../.auth/admin.json')
const AUTH_DUENO    = path.join(__dirname, '../.auth/dueno.json')
const FIXTURE       = path.join(__dirname, '../.auth/fixture.json')

async function expectRedirected(page: import('@playwright/test').Page, restrictedPath: string) {
  await page.goto(restrictedPath)
  await page.waitForURL(
    (url) => !url.pathname.startsWith(restrictedPath),
    { timeout: 8000 },
  )
  const finalPath = new URL(page.url()).pathname
  expect(finalPath).not.toContain(restrictedPath.replace('/', ''))
  return finalPath
}

// ── EMPLEADO ──────────────────────────────────────────────────────────────────

test.describe('EMPLEADO: rutas restringidas', () => {
  test.use({ storageState: AUTH_EMPLEADO })

  test('[CRÍTICO] /finanzas rechaza empleado', async ({ page }) => {
    await expectRedirected(page, '/finanzas')
  })

  test('[CRÍTICO] /configuracion rechaza empleado', async ({ page }) => {
    await expectRedirected(page, '/configuracion')
  })

  test('[CRÍTICO] /proveedores rechaza empleado', async ({ page }) => {
    await expectRedirected(page, '/proveedores')
  })

  test('[CRÍTICO] /gastos rechaza empleado', async ({ page }) => {
    await expectRedirected(page, '/gastos')
  })

  test('[CRÍTICO] botón Anular no visible para empleado', async ({ page }) => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    const admin = adminSupabase()
    const { data: venta } = await admin
      .from('ventas')
      .select('id')
      .eq('negocio_id', fixture.negocioId)
      .eq('estado', 'completada')
      .limit(1)
      .maybeSingle()

    if (!venta) {
      test.skip(true, 'Sin ventas completadas')
      return
    }

    await page.goto(`/ventas/${venta.id}`)
    await page.waitForLoadState('networkidle')

    const anularBtn = page.locator('button').filter({ hasText: /anular venta/i })
    await expect(anularBtn).toHaveCount(0, { timeout: 3000 })
  })
})

// ── RLS ────────────────────────────────────────────────────────────────────────

test.describe('[CRÍTICO] RLS: aislamiento entre negocios', () => {
  test('empleado solo ve productos de su negocio', async () => {
    const { negocioId } = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    const client = await userSupabase('test-empleado@pos-test.local', TEST_EMPLEADO.password)

    const { data } = await client.from('productos').select('id, negocio_id').limit(100)
    const cross = (data ?? []).filter((p) => p.negocio_id !== negocioId)
    expect(cross).toHaveLength(0)
  })

  test('empleado solo ve ventas de su negocio', async () => {
    const { negocioId } = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    const client = await userSupabase('test-empleado@pos-test.local', TEST_EMPLEADO.password)

    const { data } = await client.from('ventas').select('id, negocio_id').limit(100)
    const cross = (data ?? []).filter((v) => v.negocio_id !== negocioId)
    expect(cross).toHaveLength(0)
  })

  test('empleado solo ve gastos de su negocio', async () => {
    const { negocioId } = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    const client = await userSupabase('test-empleado@pos-test.local', TEST_EMPLEADO.password)

    const { data } = await client.from('gastos').select('id, negocio_id').limit(100)
    const cross = (data ?? []).filter((g) => g.negocio_id !== negocioId)
    expect(cross).toHaveLength(0)
  })

  test('[CRÍTICO] anular_venta RPC rechaza empleado directamente via API', async () => {
    // Tras migración 010: el RPC ahora valida rol='dueno' en la base.
    // Un empleado con token válido que llame el API de Supabase directamente
    // debe ser rechazado por el RPC, no solo por la UI.
    const { negocioId } = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    const admin = adminSupabase()
    const { data: venta } = await admin
      .from('ventas').select('id').eq('negocio_id', negocioId)
      .eq('estado', 'completada').limit(1).maybeSingle()

    if (!venta) { test.skip(true, 'Sin ventas completadas'); return }

    const client = await userSupabase('test-empleado@pos-test.local', TEST_EMPLEADO.password)
    const { error } = await client.rpc('anular_venta', { p_venta_id: venta.id })

    expect(error, 'El RPC debe rechazar al empleado con error de permiso').not.toBeNull()
    expect(error!.message).toMatch(/dueño/i)
  })
})

// ── ADMINISTRADOR ─────────────────────────────────────────────────────────────

test.describe('ADMINISTRADOR: acceso', () => {
  test.use({ storageState: AUTH_ADMIN })

  test('[CRÍTICO] /finanzas rechaza administrador', async ({ page }) => {
    await expectRedirected(page, '/finanzas')
  })

  test('[CRÍTICO] /configuracion rechaza administrador', async ({ page }) => {
    await expectRedirected(page, '/configuracion')
  })

  test('/gastos permite administrador', async ({ page }) => {
    await page.goto('/gastos')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/gastos')
  })

  test('/productos permite administrador', async ({ page }) => {
    await page.goto('/productos')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/productos')
  })
})

// ── DUEÑO ──────────────────────────────────────────────────────────────────────

test.describe('DUEÑO: acceso completo', () => {
  test.use({ storageState: AUTH_DUENO })

  test('/finanzas accesible para dueño', async ({ page }) => {
    await page.goto('/finanzas')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/finanzas')
  })

  test('/configuracion accesible para dueño', async ({ page }) => {
    await page.goto('/configuracion')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/configuracion')
  })
})
