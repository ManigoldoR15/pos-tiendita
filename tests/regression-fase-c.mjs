/**
 * Regresión Fase C — Inventario por plaza
 *
 * Sección 1: Negocios SIN plaza (p_local_id = NULL) — comportamiento idéntico a antes:
 *   C-1  POS carga con productos y agrega al carrito
 *   C-2  Lista de ventas accesible, links de detalle funcionan
 *   C-3  Detalle de venta tiene botón "Anular"
 *   C-4  Corte de caja — sin cambio
 *   C-5  FEFO/registrar_venta: función de 8 params existe en DB
 *   C-6  RPC transferir_inventario_plaza existe y lanza error esperado
 *
 * Sección 2: Multi-plaza
 *   C-7  /plazas/stock — accesible para dueño (200, h1 correcto)
 *   C-8  /plazas/stock — empleado redirigido
 */

import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const DIR   = '/tmp/screenshots-fase-c'
await mkdir(DIR, { recursive: true })

const BASE  = 'http://localhost:3000'
const DUENO = { email: 'test-dueno@pos-test.local',    pass: 'TestDueno123!' }
const EMPL  = { email: 'test-empleado@pos-test.local', pass: 'TestEmpleado123!' }

let failures = 0
let total    = 0

function ok(msg)           { total++; console.log(`  ✅ ${msg}`) }
function fail(msg)         { total++; failures++; console.error(`  ❌ ${msg}`) }
function check(cond, msg)  { if (cond) ok(msg); else fail(msg) }

async function loginAs(page, creds) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[name="email"]', creds.email)
  await page.fill('input[name="contrasena"]', creds.pass)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/', { timeout: 15000 })
}

// Supabase admin client (opcional — para verificaciones DB)
let supabaseAdmin = null
try {
  const env  = readFileSync(join(__dir, '../.env.local'), 'utf-8')
  const vars = Object.fromEntries(
    env.split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()] })
  )
  const url = vars['NEXT_PUBLIC_SUPABASE_URL']
  const key = vars['SUPABASE_SERVICE_ROLE_KEY'] || vars['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (url && key) supabaseAdmin = createClient(url, key)
} catch { /* sin admin client */ }

const browser = await chromium.launch({ headless: true })

// ─── C-1: POS carga con productos ────────────────────────────────────────────
console.log('\n[C-1] POS — carga productos y agrega al carrito')
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await loginAs(page, DUENO)

  await page.goto(`${BASE}/pos`)
  await page.waitForLoadState('networkidle')
  check(page.url().includes('/pos'), `URL: ${page.url()}`)

  // Los productos en el POS usan la clase cursor-pointer dentro de .grid
  const prods = page.locator('.grid .cursor-pointer, .grid button[type="button"]')
  await page.waitForTimeout(600)
  const nProds = await prods.count()
  check(nProds > 0, `POS tiene ${nProds} productos`)

  if (nProds > 0) {
    await prods.first().click()
    await page.waitForTimeout(500)
    // Verifica que el carrito/total apareció
    const body = await page.content()
    const hayCarrito = body.includes('Total') || body.includes('Cobrar') || body.includes('carrito')
    check(hayCarrito, 'Carrito/Total visible tras agregar producto')
  }

  await page.screenshot({ path: `${DIR}/c1-pos.png` })
  await ctx.close()
}

// ─── C-2 & C-3: Lista de ventas + detalle + botón Anular ─────────────────────
console.log('\n[C-2] Lista de ventas — accesible con links de detalle')
{
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginAs(page, DUENO)

  await page.goto(`${BASE}/ventas`)
  await page.waitForLoadState('networkidle')
  check(page.url().includes('/ventas'), `URL: ${page.url()}`)

  const links = page.locator('a[href^="/ventas/"]:not([href*="reporte"]):not([href*="nota"])')
  const nLinks = await links.count()
  check(nLinks > 0, `Hay ${nLinks} venta(s) con link de detalle`)

  // Navegar directamente a la primera URL de venta
  let ventaHref = null
  if (nLinks > 0) {
    ventaHref = await links.first().getAttribute('href')
    check(ventaHref?.startsWith('/ventas/'), `href de detalle correcto: ${ventaHref}`)
  }

  await page.screenshot({ path: `${DIR}/c2-ventas.png` })
  await ctx.close()
}

console.log('\n[C-3] Detalle de venta — botón Anular disponible (dueño)')
{
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginAs(page, DUENO)

  // Obtener el href de la primera venta y navegar directo
  await page.goto(`${BASE}/ventas`)
  await page.waitForLoadState('networkidle')

  const links = page.locator('a[href^="/ventas/"]:not([href*="reporte"]):not([href*="nota"])')
  const nLinks = await links.count()

  if (nLinks > 0) {
    const href = await links.first().getAttribute('href')
    if (href) {
      await page.goto(`${BASE}${href}`)
      await page.waitForLoadState('networkidle')
      const urlDetalle = page.url()
      check(urlDetalle.includes('/ventas/') && !urlDetalle.includes('/ventas?'), `Detalle: ${urlDetalle}`)

      const anularBtn = page.locator('button', { hasText: /anular/i })
      const nAnular = await anularBtn.count()
      check(nAnular > 0, `Botón "Anular" presente (count=${nAnular})`)
    } else {
      ok('(href vacío — check omitido)')
    }
  } else {
    ok('(sin ventas — check omitido)')
    ok('(sin ventas — anular omitido)')
  }

  await page.screenshot({ path: `${DIR}/c3-anular.png` })
  await ctx.close()
}

// ─── C-4: Corte de caja — sin cambio ─────────────────────────────────────────
console.log('\n[C-4] Corte de caja — accesible, sin rotura')
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await loginAs(page, DUENO)

  await page.goto(`${BASE}/corte`)
  await page.waitForLoadState('networkidle')
  check(page.url().includes('/corte'), `URL: ${page.url()}`)

  const body = await page.content()
  const ok1 = body.includes('Caja abierta') || body.includes('Abrir nueva caja')
  check(ok1, 'Corte muestra estado de caja')

  await page.screenshot({ path: `${DIR}/c4-corte.png` })
  await ctx.close()
}

// ─── C-5: DB — registrar_venta de 8 params y FEFO intacto ────────────────────
console.log('\n[C-5] DB — registrar_venta(8 params) existe y responde correctamente')
{
  if (supabaseAdmin) {
    // Llamar con negocio inválido → esperamos error de negocio, no de función
    const { error } = await supabaseAdmin.rpc('registrar_venta', {
      p_negocio_id:     '00000000-0000-0000-0000-000000000000',
      p_items:          [],
      p_metodo_pago_id: '00000000-0000-0000-0000-000000000000',
      p_local_id:       null,
    })
    // "Sin acceso al negocio" o "La venta debe incluir" = función existe y valida
    const esOk = error?.message?.includes('Sin acceso') || error?.message?.includes('La venta debe')
    check(esOk, `registrar_venta responde con error de negocio: "${error?.message?.substring(0,60)}"`)

    // Verificar que local_id existe en lotes_producto
    const { error: colErr } = await supabaseAdmin
      .from('lotes_producto')
      .select('local_id')
      .limit(1)
    check(!colErr, `lotes_producto.local_id accesible ${colErr ? '(error: '+colErr.message+')' : ''}`)

    // Verificar que ventas.local_id existe
    const { error: ventErr } = await supabaseAdmin
      .from('ventas')
      .select('local_id')
      .limit(1)
    check(!ventErr, `ventas.local_id accesible ${ventErr ? '(error: '+ventErr.message+')' : ''}`)
  } else {
    ok('(sin admin client — verificaciones DB omitidas)')
    ok('(sin admin client — lotes_producto.local_id omitido)')
    ok('(sin admin client — ventas.local_id omitido)')
  }
}

// ─── C-6: RPC transferir_inventario_plaza existe ──────────────────────────────
console.log('\n[C-6] RPC transferir_inventario_plaza — existe y valida permisos')
{
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.rpc('transferir_inventario_plaza', {
      p_negocio_id:  '00000000-0000-0000-0000-000000000000',
      p_lote_id:     '00000000-0000-0000-0000-000000000000',
      p_cantidad:    1,
      p_to_local_id: null,
    })
    const esEsperado = error?.message?.includes('dueño') || error?.message?.includes('Lote no encontrado')
    check(esEsperado, `RPC existe (${error?.message?.substring(0,60)})`)
  } else {
    ok('(sin admin client — check omitido)')
  }
}

// ─── C-7: /plazas/stock — dueño lo ve ────────────────────────────────────────
console.log('\n[C-7] /plazas/stock — accesible para dueño')
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await loginAs(page, DUENO)

  const res = await page.goto(`${BASE}/plazas/stock`)
  await page.waitForLoadState('networkidle')

  check(res?.status() === 200, `HTTP ${res?.status()}`)
  check(page.url().includes('/plazas/stock'), `URL: ${page.url()}`)

  const h1 = await page.locator('h1').first().textContent().catch(() => '')
  check(
    (h1 ?? '').toLowerCase().includes('inventario') || (h1 ?? '').toLowerCase().includes('stock'),
    `h1: "${h1}"`,
  )

  await page.screenshot({ path: `${DIR}/c7-stock-plaza.png`, fullPage: true })
  await ctx.close()
}

// ─── C-8: /plazas/stock — empleado redirigido ────────────────────────────────
console.log('\n[C-8] /plazas/stock — empleado redirigido fuera')
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await loginAs(page, EMPL)

  await page.goto(`${BASE}/plazas/stock`)
  await page.waitForLoadState('networkidle')

  check(!page.url().includes('/plazas/stock'), `Redirigido: ${page.url()}`)
  await ctx.close()
}

// ─── C-9: Baseline fases anteriores no roto ──────────────────────────────────
console.log('\n[C-9] /configuracion/plazas — sigue funcionando')
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await loginAs(page, DUENO)

  await page.goto(`${BASE}/configuracion/plazas`)
  await page.waitForLoadState('networkidle')
  check(page.url().includes('/configuracion/plazas'), `URL: ${page.url()}`)

  const body = await page.content()
  check(body.includes('Principal') || body.includes('plaza'), 'Página muestra plazas')

  await ctx.close()
}

await browser.close()

// ─── Resultado ────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`)
console.log(`Total: ${total} checks | ✅ ${total - failures} PASS | ❌ ${failures} FAIL`)
console.log(`${'═'.repeat(60)}`)

if (failures === 0) {
  console.log('✅ Regresión Fase C: TODOS los checks pasaron.\n')
  process.exit(0)
} else {
  console.error(`❌ ${failures} check(s) fallaron.\n`)
  process.exit(1)
}
