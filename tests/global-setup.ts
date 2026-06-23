import { chromium } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

export const TEST_DUENO    = { email: 'test-dueno@pos-test.local',    password: 'TestDueno123!' }
export const TEST_EMPLEADO = { email: 'test-empleado@pos-test.local', password: 'TestEmpleado123!' }
export const TEST_ADMIN    = { email: 'test-admin@pos-test.local',    password: 'TestAdmin123!' }
export const TEST_BARCODE  = 'TEST-7501234567890'

const STORAGE_DIR = path.join(__dirname, '.auth')

const WS_OPT = { realtime: { transport: ws as unknown as typeof WebSocket } }

export default async function globalSetup() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const admin = createClient(SUPA_URL, SVC_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...WS_OPT,
  })

  // ── 1. Ensure test users exist ──────────────────────────────────────────
  async function ensureUser(email: string, password: string): Promise<string> {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = list?.users.find((u) => u.email === email)
    if (existing) return existing.id
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw new Error(`Cannot create ${email}: ${error.message}`)
    return data.user.id
  }

  const duenoId    = await ensureUser(TEST_DUENO.email,    TEST_DUENO.password)
  const empleadoId = await ensureUser(TEST_EMPLEADO.email, TEST_EMPLEADO.password)
  const adminId    = await ensureUser(TEST_ADMIN.email,    TEST_ADMIN.password)

  // ── 2. Ensure dueño has a negocio ────────────────────────────────────────
  const { data: negocioExistente } = await admin
    .from('negocios')
    .select('id')
    .eq('owner_id', duenoId)
    .maybeSingle()

  let negocioId: string
  if (negocioExistente) {
    negocioId = negocioExistente.id
  } else {
    const duenoClient = createClient(SUPA_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      ...WS_OPT,
    })
    await duenoClient.auth.signInWithPassword({ email: TEST_DUENO.email, password: TEST_DUENO.password })
    const { data, error } = await duenoClient.rpc('crear_negocio', { p_nombre: 'Tienda de Prueba E2E' })
    if (error) throw new Error(`Cannot create negocio: ${error.message}`)
    negocioId = data as string
  }

  // ── 3. Ensure empleado and admin are members ─────────────────────────────
  async function ensureMember(userId: string, rol: string) {
    const { data } = await admin
      .from('usuarios_negocio')
      .select('user_id')
      .eq('negocio_id', negocioId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) {
      await admin.from('usuarios_negocio').insert({ negocio_id: negocioId, user_id: userId, rol })
    } else {
      await admin.from('usuarios_negocio').update({ rol }).eq('negocio_id', negocioId).eq('user_id', userId)
    }
  }

  await ensureMember(empleadoId, 'empleado')
  await ensureMember(adminId, 'administrador')

  // ── 4. Ensure products exist ─────────────────────────────────────────────
  const { data: existingProds } = await admin
    .from('productos')
    .select('id')
    .eq('negocio_id', negocioId)
    .eq('activo', true)
    .limit(1)

  if (!existingProds?.length) {
    await admin.from('productos').insert([
      {
        negocio_id: negocioId,
        nombre: 'Coca-Cola 600ml',
        precio_venta: 2500,
        precio_costo: 1600,
        existencias: 50,
        activo: true,
        codigo_barras: TEST_BARCODE,
      },
      {
        negocio_id: negocioId,
        nombre: 'Sabritas Original',
        precio_venta: 1500,
        precio_costo: 900,
        existencias: 30,
        activo: true,
      },
    ])
  } else {
    const { data: bc } = await admin
      .from('productos')
      .select('id')
      .eq('negocio_id', negocioId)
      .eq('codigo_barras', TEST_BARCODE)
      .maybeSingle()
    if (!bc) {
      await admin.from('productos').insert({
        negocio_id: negocioId,
        nombre: 'Producto Test Escáner',
        precio_venta: 2000,
        precio_costo: 1200,
        existencias: 99,
        activo: true,
        codigo_barras: TEST_BARCODE,
      })
    }
  }

  // ── 4b. Ensure barcode product has enough stock for scanner tests ─────────
  const { data: bcStock } = await admin
    .from('productos')
    .select('id, existencias')
    .eq('negocio_id', negocioId)
    .eq('codigo_barras', TEST_BARCODE)
    .maybeSingle()

  if (bcStock && Number(bcStock.existencias) < 5) {
    await admin.from('lotes_producto').insert({
      negocio_id: negocioId,
      producto_id: bcStock.id,
      cantidad: 10,
      cantidad_actual: 10,
    })
  }

  // ── 5. Save browser auth state ───────────────────────────────────────────
  const browser = await chromium.launch()

  const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

  async function saveAuth(email: string, password: string, file: string) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="contrasena"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
    await ctx.storageState({ path: path.join(STORAGE_DIR, file) })
    await ctx.close()
  }

  await saveAuth(TEST_DUENO.email,    TEST_DUENO.password,    'dueno.json')
  await saveAuth(TEST_EMPLEADO.email, TEST_EMPLEADO.password, 'empleado.json')
  await saveAuth(TEST_ADMIN.email,    TEST_ADMIN.password,    'admin.json')

  await browser.close()

  // ── 6. Save fixture data ─────────────────────────────────────────────────
  fs.writeFileSync(
    path.join(STORAGE_DIR, 'fixture.json'),
    JSON.stringify({ negocioId, duenoId, empleadoId, adminId }),
  )

  console.log(`[setup] negocioId=${negocioId}, dueño=${duenoId}`)
}
