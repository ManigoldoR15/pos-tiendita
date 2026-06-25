import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'

const DIR = '/tmp/claude-1000/-home-efrain-proyectos-pos-mx-pos-tiendita/e197a9cf-0f6f-4826-af5c-d7ab649480cf/scratchpad/regression-a'
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

// ── Dashboard carga
await page.waitForTimeout(800)
await shot('01-dashboard')

// ── POS — carga, productos visibles
await page.locator('nav.fixed.bottom-0 a[href="/pos"]').click()
await page.waitForURL('**/pos', { timeout: 8000 })
await page.waitForTimeout(1000)
await shot('02-pos')
const numProductos = await page.locator('.grid .cursor-pointer').count()
console.log(numProductos > 0 ? `✅ POS tiene ${numProductos} productos` : '❌ POS sin productos')

// ── POS — agregar producto al carrito
const primerProducto = page.locator('.grid .cursor-pointer').first()
await primerProducto.click()
await page.waitForTimeout(400)
await shot('03-pos-con-carrito')
const tieneTotal = await page.getByText('Total').count()
console.log(tieneTotal > 0 ? '✅ Carrito visible (Total aparece)' : '⚠️ Total no visible')

// ── Ventas
await page.locator('nav.fixed.bottom-0 a[href="/ventas"]').click()
await page.waitForURL('**/ventas', { timeout: 8000 })
await page.waitForTimeout(600)
await shot('04-ventas')
await check('Ventas cargó', () => page.locator('h1').count().then(n => n > 0))

// ── Catálogo
await page.locator('nav.fixed.bottom-0 a[href="/productos"]').click()
await page.waitForURL('**/productos', { timeout: 8000 })
await page.waitForTimeout(600)
await shot('05-catalogo')
await check('Catálogo cargó', () => page.locator('table tbody tr').count().then(n => n > 0))

// ── Configuración
await page.locator('nav.fixed.bottom-0 a[href="/configuracion"]').click()
await page.waitForURL('**/configuracion', { timeout: 8000 })
await page.waitForTimeout(600)
await shot('06-config')
await check('Config cargó', () => page.locator('h1').count().then(n => n > 0))

await browser.close()
console.log('\n✅ Regresión Fase A completada. Screenshots:', DIR)
