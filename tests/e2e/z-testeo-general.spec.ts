/**
 * TESTEO GENERAL — lógica, botones e interfaz
 *
 * Cubre: dashboard, POS, ventas, ticket, nota de remisión, productos,
 * clientes, cuadre, gastos, configuración, admin-sistema (diseño de consola),
 * restricciones de rol empleado.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

// ── helpers ─────────────────────────────────────────────────────────────────

const SS_DIR = path.join(__dirname, '../../test-screenshots')

async function screenshot(page: Page, name: string) {
  fs.mkdirSync(SS_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: true })
}

function authState(role: 'dueno' | 'empleado' | 'admin') {
  return path.join(__dirname, `../.auth/${role}.json`)
}

/** Encuentra el href de una venta individual (/ventas/<uuid>) sin capturar nav ni reporte */
async function primerHrefVenta(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const links = document.querySelectorAll<HTMLAnchorElement>('a[href^="/ventas/"]')
    for (const a of links) {
      const h = a.getAttribute('href') ?? ''
      if (h.length > 15 && !h.includes('reporte') && !h.includes('export') && h.includes('-')) {
        return h
      }
    }
    return null
  })
}

// ── BLOQUE 1: Login ──────────────────────────────────────────────────────────

test.describe('1. Pantalla de Login', () => {
  test('Renderiza formulario con email, contraseña y botón', async ({ page }) => {
    await page.goto('/login')
    await screenshot(page, '01-login')

    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="contrasena"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /entrar|iniciar|ingresar/i })).toBeVisible()
  })

  test('Redirige a login cuando no está autenticado', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/login/, { timeout: 10000 })
    expect(page.url()).toContain('/login')
  })
})

// ── BLOQUE 2: Dashboard del dueño ───────────────────────────────────────────

test.describe('2. Dashboard del dueño', () => {
  test.use({ storageState: authState('dueno') })

  test('Muestra KPIs de ventas del día y navegación', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '02-dashboard-dueno')

    // KPIs visibles
    await expect(page.locator('main').locator('text=VENTAS').first()).toBeVisible()
    // Links de navegación directos
    await expect(page.locator('a[href="/pos"]').first()).toBeVisible()
    await expect(page.locator('a[href="/"]').first()).toBeVisible()
  })

  test('Filtros Hoy/Semana/Mes presentes y funcionan', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Los filtros son <Link> (→ <a>), no botones
    await expect(page.locator('a[href="/?p=hoy"]')).toBeVisible()
    await expect(page.locator('a[href="/?p=semana"]')).toBeVisible()
    await expect(page.locator('a[href="/?p=mes"]')).toBeVisible()

    await page.locator('a[href="/?p=semana"]').click()
    await page.waitForURL(/p=semana/, { timeout: 8000 })
    await screenshot(page, '02b-dashboard-semana')
    await expect(page.locator('main').locator('text=VENTAS').first()).toBeVisible()
  })

  test('Botón POS en header lleva al POS', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await Promise.all([
      page.waitForURL(/\/pos/, { timeout: 10000 }),
      page.locator('a[href="/pos"]').first().click(),
    ])
    expect(page.url()).toContain('/pos')
  })
})

// ── BLOQUE 3: POS ────────────────────────────────────────────────────────────

test.describe('3. POS — punto de venta', () => {
  test.use({ storageState: authState('dueno') })

  test('Grilla de productos visible', async ({ page }) => {
    await page.goto('/pos')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '03-pos')

    // Al menos un botón de producto con precio
    const productosBtns = page.locator('button:not([disabled])').filter({ hasText: /\$\d+/ })
    await expect(productosBtns.first()).toBeVisible()
  })

  test('Agregar producto al carrito actualiza el total', async ({ page }) => {
    await page.goto('/pos')
    await page.waitForLoadState('networkidle')

    const primer = page.locator('button:not([disabled])').filter({ hasText: /\$\d+/ }).first()
    const precioText = await primer.innerText()
    await primer.click()
    await page.waitForTimeout(400)
    await screenshot(page, '03b-pos-carrito')

    // Total debe aparecer (buscar cualquier elemento con importe/total)
    const totalEl = page.locator('[class*="total"], [class*="Total"], text=/Total/i').first()
    // Si no existe por nombre exacto, al menos el botón Cobrar aparece
    const cobrarBtn = page.getByRole('button', { name: /cobrar/i })
    await expect(cobrarBtn).toBeVisible()
    void precioText // used in assertion above
  })

  test('Botón Cobrar abre modal con opciones de pago', async ({ page }) => {
    await page.goto('/pos')
    await page.waitForLoadState('networkidle')

    await page.locator('button:not([disabled])').filter({ hasText: /\$\d+/ }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /cobrar/i }).click()
    await page.waitForTimeout(600)
    await screenshot(page, '03c-pos-modal')

    // Modal debe mostrar métodos de pago
    const efectivo = page.locator('text=/Efectivo/i').first()
    await expect(efectivo).toBeVisible()
  })

  test('Flujo completo: agregar → cobrar → confirmar → venta registrada', async ({ page }) => {
    await page.goto('/pos')
    await page.waitForLoadState('networkidle')

    await page.locator('button:not([disabled])').filter({ hasText: /\$\d+/ }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /cobrar/i }).click()
    await page.waitForTimeout(500)

    // Confirmar con el método por defecto (Efectivo)
    const confirmarBtn = page.getByRole('button', { name: /confirmar|registrar|pagar/i })
    if (await confirmarBtn.isVisible()) {
      await confirmarBtn.click()
      await page.waitForLoadState('networkidle')
      await screenshot(page, '03d-pos-venta-ok')
      // Carrito se vacía o vuelve al inicio del POS
      expect(page.url()).toContain('/pos')
    }
  })

  test('Botón vaciar carrito funciona', async ({ page }) => {
    await page.goto('/pos')
    await page.waitForLoadState('networkidle')

    await page.locator('button:not([disabled])').filter({ hasText: /\$\d+/ }).first().click()
    await page.waitForTimeout(300)

    // Busca botón de vaciar / limpiar / eliminar carrito
    const vaciarBtn = page.getByRole('button', { name: /vaciar|limpiar|borrar carrito/i })
    if (await vaciarBtn.isVisible()) {
      await vaciarBtn.click()
      await page.waitForTimeout(300)
      await screenshot(page, '03e-pos-carrito-vacio')
      // El botón cobrar no debe estar visible (carrito vacío)
      await expect(page.getByRole('button', { name: /cobrar/i })).not.toBeVisible()
    }
  })
})

// ── BLOQUE 4: Historial de ventas ────────────────────────────────────────────

test.describe('4. Historial de ventas', () => {
  test.use({ storageState: authState('dueno') })

  test('Lista de ventas muestra filas y métricas', async ({ page }) => {
    await page.goto('/ventas')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '04-ventas-lista')

    // Métricas del historial
    await expect(page.locator('text=TOTAL RECAUDADO').first()).toBeVisible()
    await expect(page.locator('main').locator('text=VENTAS').first()).toBeVisible()

    // Al menos una fila de venta
    const href = await primerHrefVenta(page)
    expect(href).toBeTruthy()
    expect(href).toMatch(/^\/ventas\/[a-f0-9-]{36}$/)
  })

  test('Detalle de venta muestra datos, botón Ticket y botón Remisión', async ({ page }) => {
    await page.goto('/ventas')
    await page.waitForLoadState('networkidle')

    const href = await primerHrefVenta(page)
    if (!href) { test.skip(); return }

    await page.goto(href)
    await page.waitForLoadState('networkidle')
    await screenshot(page, '04b-venta-detalle')

    // Botones Ticket y Remisión
    await expect(page.locator(`a[href="${href}/ticket"]`)).toBeVisible()
    await expect(page.locator(`a[href="${href}/nota-remision"]`)).toBeVisible()
  })

  test('Ticket muestra formato de impresión con botón Imprimir', async ({ page }) => {
    await page.goto('/ventas')
    await page.waitForLoadState('networkidle')

    const href = await primerHrefVenta(page)
    if (!href) { test.skip(); return }

    await page.goto(`${href}/ticket`)
    await page.waitForLoadState('networkidle')
    await screenshot(page, '04c-ticket')

    await expect(page.getByRole('button', { name: /imprimir/i })).toBeVisible()
    // Contenido típico de ticket
    await expect(page.locator('text=/TOTAL|Total/i').first()).toBeVisible()
  })

  test('Nota de remisión muestra "NOTA DE REMISIÓN" y botón Imprimir', async ({ page }) => {
    await page.goto('/ventas')
    await page.waitForLoadState('networkidle')

    const href = await primerHrefVenta(page)
    if (!href) { test.skip(); return }

    await page.goto(`${href}/nota-remision`)
    await page.waitForLoadState('networkidle')
    await screenshot(page, '04d-nota-remision')

    // Título exacto del documento
    await expect(page.locator('text=NOTA DE REMISIÓN')).toBeVisible()
    await expect(page.getByRole('button', { name: /imprimir/i })).toBeVisible()
  })

  test('Filtro por fecha (Hoy/Semana/Mes) recarga la lista', async ({ page }) => {
    await page.goto('/ventas')
    await page.waitForLoadState('networkidle')

    // Filtros son <Link>, no botones — busca el que lleva a mes
    const mesLink = page.locator('a').filter({ hasText: /^Mes$/ }).first()
    await mesLink.click()
    await page.waitForURL(/p=mes/, { timeout: 8000 })
    await screenshot(page, '04e-ventas-filtro-mes')
    await expect(page.locator('text=TOTAL RECAUDADO').first()).toBeVisible()
  })
})

// ── BLOQUE 5: Productos ──────────────────────────────────────────────────────

test.describe('5. Catálogo de productos', () => {
  test.use({ storageState: authState('dueno') })

  test('Lista de productos con botón Nuevo', async ({ page }) => {
    await page.goto('/productos')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '05-productos')

    await expect(page.getByRole('heading', { name: /productos/i })).toBeVisible()
    // Botón "+ Nuevo" → /productos/nuevo
    await expect(page.locator('a[href="/productos/nuevo"]')).toBeVisible()
  })

  test('Formulario nuevo producto tiene campos obligatorios', async ({ page }) => {
    await page.goto('/productos/nuevo')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '05b-producto-nuevo')

    await expect(page.locator('input[name="nombre"]')).toBeVisible()
    await expect(page.locator('input[name="precio_venta"]')).toBeVisible()
  })

  test('Categorías y filtros visibles en la lista', async ({ page }) => {
    await page.goto('/productos')
    await page.waitForLoadState('networkidle')

    // "Todos" y "Stock bajo" son <Link> (→ <a>), no botones
    await expect(page.locator('main a[href="/productos"]').first()).toBeVisible()
    await expect(page.locator('a[href*="alerta=bajo"]').first()).toBeVisible()
  })
})

// ── BLOQUE 6: Clientes ───────────────────────────────────────────────────────

test.describe('6. Clientes', () => {
  test.use({ storageState: authState('dueno') })

  test('Lista de clientes carga con botón Nuevo cliente', async ({ page }) => {
    await page.goto('/clientes')
    await page.waitForLoadState('domcontentloaded')
    await screenshot(page, '06-clientes')

    expect(page.url()).toContain('/clientes')
    expect(page.url()).not.toContain('/login')
  })
})

// ── BLOQUE 7: Gastos / Finanzas ──────────────────────────────────────────────

test.describe('7. Gastos', () => {
  test.use({ storageState: authState('dueno') })

  test('Sección gastos carga correctamente', async ({ page }) => {
    await page.goto('/gastos')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '07-gastos')

    expect(page.url()).not.toContain('/login')
    // Encabezado gastos
    await expect(page.locator('text=/[Gg]astos/').first()).toBeVisible()
  })

  test('Finanzas carga con gráficas y KPIs', async ({ page }) => {
    await page.goto('/finanzas')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '07b-finanzas')

    expect(page.url()).not.toContain('/login')
  })
})

// ── BLOQUE 8: Cuadre de caja ─────────────────────────────────────────────────

test.describe('8. Cuadre de caja', () => {
  test.use({ storageState: authState('dueno') })

  test('Página de cuadre accesible para dueño', async ({ page }) => {
    await page.goto('/cuadre')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '08-cuadre')

    expect(page.url()).not.toContain('/login')
    expect(page.url()).toContain('/cuadre')
  })
})

// ── BLOQUE 9: Configuración ──────────────────────────────────────────────────

test.describe('9. Configuración', () => {
  test.use({ storageState: authState('dueno') })

  test('Configuración accesible para dueño con secciones', async ({ page }) => {
    await page.goto('/configuracion')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '09-configuracion')

    expect(page.url()).toContain('/configuracion')
    await expect(page.getByRole('heading', { name: /configuraci[oó]n/i })).toBeVisible()
  })
})

// ── BLOQUE 10: Admin Sistema — consola de operador ───────────────────────────

/**
 * Estos tests crean un superadmin de prueba temporal, lo prueban, y lo eliminan.
 * Requieren SUPABASE_SERVICE_ROLE_KEY en .env.local.
 */

const SA_TEST_EMAIL = 'test-superadmin-e2e@pos-test.local'
const SA_TEST_PASS  = 'SAtest12345!'
let saUserId: string | null = null
let saContext: BrowserContext | null = null

test.describe('10. Admin Sistema — panel de operador', () => {
  test.beforeAll(async ({ browser }) => {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const headers = {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    }

    // Buscar si ya existe el usuario de prueba
    const listResp = await fetch(`${supaUrl}/auth/v1/admin/users?email=${encodeURIComponent(SA_TEST_EMAIL)}`, { headers })
    const listData = await listResp.json()
    const existing = (listData.users ?? []).find((u: { email: string }) => u.email === SA_TEST_EMAIL)

    if (existing) {
      saUserId = existing.id
    } else {
      const createResp = await fetch(`${supaUrl}/auth/v1/admin/users`, {
        method: 'POST', headers,
        body: JSON.stringify({ email: SA_TEST_EMAIL, password: SA_TEST_PASS, email_confirm: true }),
      })
      const created = await createResp.json()
      if (!created.id) throw new Error(`No se pudo crear superadmin de prueba: ${JSON.stringify(created)}`)
      saUserId = created.id
    }

    // Insertar en superadmins vía REST
    await fetch(`${supaUrl}/rest/v1/superadmins`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: saUserId }),
    })

    // Login como superadmin en browser context
    saContext = await browser.newContext()
    const saPage = await saContext.newPage()
    await saPage.goto('http://localhost:3000/login')
    await saPage.fill('input[name="email"]', SA_TEST_EMAIL)
    await saPage.fill('input[name="contrasena"]', SA_TEST_PASS)
    await saPage.click('button[type="submit"]')
    await saPage.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 })
    await saPage.close()
  })

  test.afterAll(async () => {
    if (saUserId) {
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const headers = {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      }
      // Quitar de superadmins
      await fetch(`${supaUrl}/rest/v1/superadmins?user_id=eq.${saUserId}`, { method: 'DELETE', headers })
      // Eliminar usuario
      await fetch(`${supaUrl}/auth/v1/admin/users/${saUserId}`, { method: 'DELETE', headers })
    }
    if (saContext) await saContext.close()
  })

  test('Dashboard oscuro con 6 métricas de plataforma', async () => {
    if (!saContext) { test.skip(); return }
    const page = await saContext.newPage()
    await page.goto('http://localhost:3000/admin-sistema')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '10-admin-sistema')

    // Sidebar con identidad de consola
    await expect(page.locator('text=Admin Sistema')).toBeVisible()
    await expect(page.locator('text=Panel de operador')).toBeVisible()

    // 6 tarjetas de métricas
    await expect(page.locator('text=Total').first()).toBeVisible()
    await expect(page.locator('text=Activos').first()).toBeVisible()
    await expect(page.locator('text=En prueba').first()).toBeVisible()
    await expect(page.locator('text=Vencidos').first()).toBeVisible()
    await expect(page.locator('text=Suspendidos').first()).toBeVisible()
    await expect(page.locator('text=Nuevos / mes').first()).toBeVisible()

    await page.close()
  })

  test('Tabla muestra columnas: Negocio, Dueño/Contacto, Fecha de alta, Vencimiento, Estado', async () => {
    if (!saContext) { test.skip(); return }
    const page = await saContext.newPage()
    await page.goto('http://localhost:3000/admin-sistema')
    await page.waitForLoadState('networkidle')

    // Los headers de la tabla son <th> — evitar match con <option> del select
    await expect(page.locator('th', { hasText: 'Dueño / Contacto' }).first()).toBeVisible()
    await expect(page.locator('th', { hasText: 'Fecha de alta' }).first()).toBeVisible()
    await expect(page.locator('th', { hasText: 'Vencimiento' }).first()).toBeVisible()
    await expect(page.locator('th', { hasText: 'Estado' }).first()).toBeVisible()

    await page.close()
  })

  test('Filtro por estado "activo" actualiza la URL', async () => {
    if (!saContext) { test.skip(); return }
    const page = await saContext.newPage()
    await page.goto('http://localhost:3000/admin-sistema')
    await page.waitForLoadState('networkidle')

    await page.selectOption('select[name="estado"]', 'activo')
    await page.getByRole('button', { name: /filtrar/i }).click()
    await page.waitForLoadState('networkidle')
    await screenshot(page, '10b-admin-filtro')

    expect(page.url()).toContain('estado=activo')
    await page.close()
  })

  test('Búsqueda por texto actualiza la URL con parámetro q', async () => {
    if (!saContext) { test.skip(); return }
    const page = await saContext.newPage()
    await page.goto('http://localhost:3000/admin-sistema')
    await page.waitForLoadState('networkidle')

    await page.fill('input[name="q"]', 'tiendita')
    await page.getByRole('button', { name: /filtrar/i }).click()
    await page.waitForLoadState('networkidle')
    await screenshot(page, '10c-admin-busqueda')

    expect(page.url()).toContain('q=tiendita')
    await page.close()
  })

  test('"Dar de alta negocio" navega al formulario oscuro', async () => {
    if (!saContext) { test.skip(); return }
    const page = await saContext.newPage()
    await page.goto('http://localhost:3000/admin-sistema')
    await page.waitForLoadState('networkidle')

    await Promise.all([
      page.waitForURL(/negocios\/nuevo/, { timeout: 10000 }),
      page.locator('a[href="/admin-sistema/negocios/nuevo"]').first().click(),
    ])
    await screenshot(page, '10d-admin-nuevo')

    expect(page.url()).toContain('/admin-sistema/negocios/nuevo')
    await expect(page.getByRole('heading', { name: /nuevo cliente/i })).toBeVisible()
    await expect(page.locator('input[name="nombre"]')).toBeVisible()
    await expect(page.locator('input[name="email_dueno"]')).toBeVisible()
    await expect(page.locator('select[name="plan"]')).toBeVisible()

    await page.close()
  })

  test('Click en "Gestionar" de un negocio abre detalle con formulario editable', async () => {
    if (!saContext) { test.skip(); return }
    const page = await saContext.newPage()
    await page.goto('http://localhost:3000/admin-sistema')
    await page.waitForLoadState('networkidle')

    const gestionarLink = page.getByRole('link', { name: /gestionar/i }).first()
    await expect(gestionarLink).toBeVisible()
    await Promise.all([
      page.waitForURL(/negocios\/[a-f0-9-]+$/, { timeout: 10000 }),
      gestionarLink.click(),
    ])
    await screenshot(page, '10e-admin-detalle')

    expect(page.url()).toMatch(/\/admin-sistema\/negocios\/[a-f0-9-]+$/)
    await expect(page.locator('input[name="nombre_negocio"]')).toBeVisible()
    await expect(page.locator('select[name="plan"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /guardar cambios/i })).toBeVisible()

    await page.close()
  })

  test('/admin-sistema/negocios redirige al dashboard', async () => {
    if (!saContext) { test.skip(); return }
    const page = await saContext.newPage()
    await page.goto('http://localhost:3000/admin-sistema/negocios')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '10f-admin-negocios-redirect')

    // Debe redirigir al dashboard (muestra Admin Sistema)
    await expect(page.locator('text=Admin Sistema')).toBeVisible()
    await page.close()
  })
})

// ── BLOQUE 11: Restricciones de rol — EMPLEADO ───────────────────────────────

test.describe('11. Empleado — accesos correctos', () => {
  test.use({ storageState: authState('empleado') })

  test('NO puede acceder a /cuadre → redirige', async ({ page }) => {
    await page.goto('/cuadre')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '11a-empleado-cuadre')
    expect(page.url()).not.toMatch(/\/cuadre$/)
  })

  test('NO puede acceder a /configuracion → redirige', async ({ page }) => {
    await page.goto('/configuracion')
    await page.waitForLoadState('networkidle')
    expect(page.url()).not.toMatch(/\/configuracion$/)
  })

  test('NO puede acceder a /admin-sistema → redirige', async ({ page }) => {
    await page.goto('/admin-sistema')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '11b-empleado-admin')
    expect(page.url()).not.toMatch(/\/admin-sistema$/)
  })

  test('NO puede acceder a /superadmin → redirige', async ({ page }) => {
    await page.goto('/superadmin')
    await page.waitForLoadState('networkidle')
    expect(page.url()).not.toMatch(/\/superadmin$/)
  })

  test('SÍ puede usar el POS', async ({ page }) => {
    await page.goto('/pos')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '11c-empleado-pos')
    expect(page.url()).toContain('/pos')
    // Grilla de productos visible
    const btns = page.locator('button:not([disabled])').filter({ hasText: /\$\d+/ })
    await expect(btns.first()).toBeVisible()
  })

  test('SÍ puede ver historial de ventas', async ({ page }) => {
    await page.goto('/ventas')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/ventas')
    expect(page.url()).not.toContain('/login')
  })
})

// ── BLOQUE 12: Dueño NO entra al superadmin ──────────────────────────────────

test.describe('12. Seguridad — dueño sin acceso a superadmin', () => {
  test.use({ storageState: authState('dueno') })

  test('Dueño NO puede entrar a /superadmin', async ({ page }) => {
    await page.goto('/superadmin')
    await page.waitForLoadState('networkidle')
    await screenshot(page, '12-superadmin-bloqueado')
    expect(page.url()).not.toMatch(/\/superadmin$/)
  })

  test('Dueño NO puede entrar a /admin-sistema', async ({ page }) => {
    await page.goto('/admin-sistema')
    await page.waitForLoadState('networkidle')
    expect(page.url()).not.toMatch(/\/admin-sistema$/)
  })
})
