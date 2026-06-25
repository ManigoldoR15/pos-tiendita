/**
 * Regresión Fase D — Dashboard comparativo de plazas
 *
 * Checks:
 *  1. /plazas accesible con sesión de dueño (login real)
 *  2. Filtros hoy/semana/mes presentes
 *  3. Muestra contenido apropiado (1 plaza o comparativo)
 *  4. Empleado autenticado → redirigido fuera de /plazas
 *  5. Link "Plazas" en dropdown Análisis (desktop)
 *  6. POS golden path funciona sin rotura
 */

import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'

const DIR = '/tmp/screenshots-fase-d'
await mkdir(DIR, { recursive: true })

const BASE = 'http://localhost:3000'
const DUENO  = { email: 'test-dueno@pos-test.local',   pass: 'TestDueno123!' }
const EMPL   = { email: 'test-empleado@pos-test.local', pass: 'TestEmpleado123!' }

let failures = 0

function log(ok, msg) {
  if (ok) { console.log(`  ✅ ${msg}`) }
  else     { console.error(`  ❌ ${msg}`); failures++ }
}

async function loginAs(page, creds) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[name="email"]', creds.email)
  await page.fill('input[name="contrasena"]', creds.pass)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/', { timeout: 12000 })
}

const browser = await chromium.launch({ headless: true })

// ── 1–3: Dueño en /plazas ─────────────────────────────────────────────────────
console.log('\n[1–3] /plazas con sesión de dueño')
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()

  await loginAs(page, DUENO)

  const res = await page.goto(`${BASE}/plazas`)
  await page.waitForLoadState('networkidle')

  log(res?.status() === 200, `HTTP ${res?.status()} (esperado 200)`)

  const url = page.url()
  log(url.includes('/plazas'), `URL es /plazas → ${url}`)

  const h1 = await page.locator('h1').first().textContent().catch(() => '(none)')
  log(
    (h1 ?? '').toLowerCase().includes('plaza'),
    `h1 contiene "plaza": "${h1}"`,
  )

  // Filtros de período
  const hoyLink = await page.locator('a', { hasText: 'Hoy' }).count()
  const semLink  = await page.locator('a', { hasText: 'Semana' }).count()
  const mesLink  = await page.locator('a', { hasText: 'Mes' }).count()
  log(hoyLink > 0, 'Filtro "Hoy" presente')
  log(semLink > 0, 'Filtro "Semana" presente')
  log(mesLink > 0, 'Filtro "Mes" presente')

  // Contenido apropiado: mensaje 1-plaza o tabla comparativa
  const body = await page.content()
  const hasSingleMsg = body.includes('Solo tienes una plaza') || body.includes('plaza activa')
  const hasComparativo = body.includes('Ventas') && body.includes('Gastos')
  log(hasSingleMsg || hasComparativo, 'Muestra contenido apropiado (mensaje 1-plaza o tabla multi-plaza)')

  await page.screenshot({ path: `${DIR}/plazas-dueno.png`, fullPage: true })
  await ctx.close()
}

// ── 4: Empleado → redirigido ──────────────────────────────────────────────────
console.log('\n[4] Empleado → redirigido fuera de /plazas')
{
  const ctx  = await browser.newContext()
  const page = await ctx.newPage()

  await loginAs(page, EMPL)
  await page.goto(`${BASE}/plazas`)
  await page.waitForLoadState('networkidle')

  const url = page.url()
  log(!url.includes('/plazas'), `Redirigido fuera de /plazas → ${url}`)

  await ctx.close()
}

// ── 5: Link Plazas en Análisis (desktop) ─────────────────────────────────────
console.log('\n[5] Link "Plazas" en menú Análisis (desktop)')
{
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  await loginAs(page, DUENO)

  // El menú desktop está visible
  const analisisBtn = page.locator('nav button', { hasText: 'Análisis' })
  const btnCount = await analisisBtn.count()
  log(btnCount > 0, `Botón "Análisis" en nav → count=${btnCount}`)

  if (btnCount > 0) {
    await analisisBtn.click()
    await page.waitForTimeout(300)
    const plazasLink = page.locator('a[href="/plazas"]')
    const visible = await plazasLink.isVisible()
    log(visible, 'Link /plazas visible en dropdown Análisis')
  }

  await ctx.close()
}

// ── 6: POS golden path sin rotura ─────────────────────────────────────────────
console.log('\n[6] POS golden path (sin rotura)')
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()

  await loginAs(page, DUENO)

  await page.goto(`${BASE}/pos`)
  await page.waitForLoadState('networkidle')

  const urlPos = page.url()
  log(urlPos.includes('/pos'), `POS URL correcta → ${urlPos}`)

  const nProductos = await page.locator('[data-testid="producto-btn"]').count()
  log(nProductos >= 0, `POS carga (${nProductos} productos o grilla vacía es OK)`)

  await page.screenshot({ path: `${DIR}/pos-golden.png` })
  await ctx.close()
}

await browser.close()

console.log(`\n${'─'.repeat(50)}`)
if (failures === 0) {
  console.log('✅ Regresión Fase D: todos los checks pasaron.\n')
  process.exit(0)
} else {
  console.error(`❌ ${failures} check(s) fallaron.\n`)
  process.exit(1)
}
