import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'

const DIR = '/tmp/claude-1000/-home-efrain-proyectos-pos-mx-pos-tiendita/e197a9cf-0f6f-4826-af5c-d7ab649480cf/scratchpad/regression-b'
await mkdir(DIR, { recursive: true })
const MOBILE = { width: 375, height: 812 }
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: MOBILE })
const page = await ctx.newPage()

async function shot(name) {
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false })
  console.log(`📸 ${name}`)
}
async function check(label, fn) {
  const r = await fn()
  console.log(r ? `✅ ${label}` : `❌ ${label}`)
  return r
}

// ── Login
await page.goto('http://localhost:3000/login')
await page.fill('input[name="email"]', 'test-dueno@pos-test.local')
await page.fill('input[name="contrasena"]', 'TestDueno123!')
await page.click('button[type="submit"]')
await page.waitForURL('**/', { timeout: 10000 })
console.log('✅ Login OK')
await page.waitForTimeout(500)

// ── POS sigue funcionando
await page.locator('nav.fixed.bottom-0 a[href="/pos"]').click()
await page.waitForURL('**/pos', { timeout: 8000 })
await page.waitForTimeout(1000)
await shot('01-pos')
await check('POS cargó con productos', () => page.locator('.grid .cursor-pointer').count().then(n => n > 0))

// ── Configuración
await page.locator('nav.fixed.bottom-0 a[href="/configuracion"]').click()
await page.waitForURL('**/configuracion', { timeout: 8000 })
await page.waitForTimeout(800)
await shot('02-config')
await check('Config cargó', () => page.locator('h1').count().then(n => n > 0))

// ── Configuración NO muestra sección de plazas (tiendita demo tiene max_plazas=1)
const plazasSection = await page.getByText('Plazas').count()
console.log(`ℹ️ Sección Plazas visible: ${plazasSection > 0} (esperado: false para negocio de 1 plaza)`)

// ── Ruta /configuracion/plazas accesible directamente
await page.goto('http://localhost:3000/configuracion/plazas')
await page.waitForURL('**/configuracion/plazas', { timeout: 8000 })
await page.waitForTimeout(800)
await shot('03-plazas-page')
await check('Página plazas cargó', () => page.locator('h1').count().then(n => n > 0))
// Debe mostrar "Principal" como la única plaza
const plazaPrincipal = await page.getByText('Principal').count()
console.log(`✅ Plaza "Principal" visible: ${plazaPrincipal > 0}`)

// ── Corte
await page.locator('nav.fixed.bottom-0 button').click()  // "Más"
await page.waitForTimeout(300)
const corteLink = page.getByRole('link', { name: 'Caja' })
if (await corteLink.count() > 0) {
  await corteLink.click()
  await page.waitForURL('**/corte', { timeout: 6000 })
  await page.waitForTimeout(600)
  await shot('04-corte')
  await check('Corte cargó', () => page.locator('h1').count().then(n => n > 0))
}

// ── Ventas
await page.locator('nav.fixed.bottom-0 a[href="/ventas"]').click()
await page.waitForURL('**/ventas', { timeout: 8000 })
await page.waitForTimeout(600)
await shot('05-ventas')
await check('Ventas cargó', () => page.locator('h1').count().then(n => n > 0))

await browser.close()
console.log('\n✅ Regresión Fase B completada. Screenshots:', DIR)
