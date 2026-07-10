/**
 * Test k: AISLAMIENTO MULTI-TENANT.
 *
 * El dueño de un negocio "atacante" (recién creado) intenta leer y escribir
 * datos del negocio de la Tienda de Prueba E2E. TODO debe ser rechazado:
 * ni PostgREST (RLS) ni las RPC (SECURITY DEFINER validan membresía) deben
 * filtrar ni permitir tocar datos de otro tenant.
 *
 * Un fallo aquí = una tienda puede ver/alterar las ventas, el inventario o el
 * dinero de otra. Es el riesgo #1 de un SaaS multi-tenant.
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { adminSupabase, userSupabase } from '../helpers/supa'

const FIXTURE = path.join(__dirname, '../.auth/fixture.json')

const ATACANTE = { email: 'test-atacante@pos-test.local', password: 'Ts!Atk_9931xVpQ_zz2' }

test.describe('[CRÍTICO] Aislamiento entre negocios (multi-tenant)', () => {
  let victimaNegocioId: string
  let victimaProductoId: string
  let victimaVentaId: string | null = null
  let victimaClienteId: string | null = null
  let victimaCorteId: string | null = null
  let atacanteNegocioId: string
  let atacanteMetodoId: string | null = null

  test.beforeAll(async () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    victimaNegocioId = fixture.negocioId

    const admin = adminSupabase()

    // Datos de la víctima que el atacante intentará tocar
    const { data: prod } = await admin
      .from('productos').select('id').eq('negocio_id', victimaNegocioId).eq('activo', true).limit(1).maybeSingle()
    victimaProductoId = prod!.id
    const { data: venta } = await admin
      .from('ventas').select('id').eq('negocio_id', victimaNegocioId).limit(1).maybeSingle()
    victimaVentaId = venta?.id ?? null
    const { data: cli } = await admin
      .from('clientes').select('id').eq('negocio_id', victimaNegocioId).limit(1).maybeSingle()
    victimaClienteId = cli?.id ?? null
    const { data: corte } = await admin
      .from('cortes_caja').select('id').eq('negocio_id', victimaNegocioId).limit(1).maybeSingle()
    victimaCorteId = corte?.id ?? null

    // Crear el usuario atacante y SU PROPIO negocio (dueño legítimo del suyo)
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    let atacanteId = list?.users.find((u) => u.email === ATACANTE.email)?.id
    if (!atacanteId) {
      const { data } = await admin.auth.admin.createUser({ email: ATACANTE.email, password: ATACANTE.password, email_confirm: true })
      atacanteId = data.user!.id
    }
    const { data: negExistente } = await admin
      .from('negocios').select('id').eq('owner_id', atacanteId).maybeSingle()
    if (negExistente) {
      atacanteNegocioId = negExistente.id
    } else {
      const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
      const { data, error } = await atk.rpc('crear_negocio', { p_nombre: 'Negocio Atacante E2E' })
      if (error) throw new Error(`No se pudo crear negocio atacante: ${error.message}`)
      atacanteNegocioId = data as string
    }
    const { data: mp } = await admin
      .from('metodos_pago').select('id').eq('negocio_id', atacanteNegocioId).limit(1).maybeSingle()
    atacanteMetodoId = mp?.id ?? null
  })

  // ── LECTURA vía PostgREST: RLS debe devolver 0 filas ───────────────────────

  test('no puede LEER productos de otro negocio', async () => {
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { data } = await atk.from('productos').select('id').eq('negocio_id', victimaNegocioId)
    expect(data ?? []).toHaveLength(0)
  })

  test('no puede LEER ventas de otro negocio', async () => {
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { data } = await atk.from('ventas').select('id').eq('negocio_id', victimaNegocioId)
    expect(data ?? []).toHaveLength(0)
  })

  test('no puede LEER clientes de otro negocio', async () => {
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { data } = await atk.from('clientes').select('id, nombre, telefono').eq('negocio_id', victimaNegocioId)
    expect(data ?? []).toHaveLength(0)
  })

  test('no puede LEER cortes de caja de otro negocio', async () => {
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { data } = await atk.from('cortes_caja').select('id, monto_esperado').eq('negocio_id', victimaNegocioId)
    expect(data ?? []).toHaveLength(0)
  })

  test('no puede LEER la fila del negocio ajeno', async () => {
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { data } = await atk.from('negocios').select('id, nombre').eq('id', victimaNegocioId)
    expect(data ?? []).toHaveLength(0)
  })

  // ── ESCRITURA vía PostgREST: RLS bloquea (0 filas afectadas o error) ────────

  test('no puede ALTERAR el precio de un producto ajeno', async () => {
    const admin = adminSupabase()
    const { data: before } = await admin.from('productos').select('precio_venta').eq('id', victimaProductoId).single()
    const original = before!.precio_venta

    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    await atk.from('productos').update({ precio_venta: 1 }).eq('id', victimaProductoId)

    const { data: after } = await admin.from('productos').select('precio_venta').eq('id', victimaProductoId).single()
    expect(after!.precio_venta, 'RLS debe impedir el UPDATE cross-tenant').toBe(original)
  })

  test('no puede INSERTAR un producto en el negocio ajeno', async () => {
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { error } = await atk
      .from('productos')
      .insert({ negocio_id: victimaNegocioId, nombre: 'Producto pirata', precio_venta: 1, precio_costo: 0, existencias: 0, activo: true })
    expect(error, 'RLS debe bloquear INSERT cross-tenant').not.toBeNull()

    const admin = adminSupabase()
    const { data } = await admin.from('productos').select('id').eq('negocio_id', victimaNegocioId).eq('nombre', 'Producto pirata')
    expect(data ?? []).toHaveLength(0)
  })

  test('no puede BORRAR productos del negocio ajeno', async () => {
    const admin = adminSupabase()
    const { count: antes } = await admin
      .from('productos').select('id', { count: 'exact', head: true }).eq('negocio_id', victimaNegocioId)

    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    await atk.from('productos').delete().eq('negocio_id', victimaNegocioId)

    const { count: despues } = await admin
      .from('productos').select('id', { count: 'exact', head: true }).eq('negocio_id', victimaNegocioId)
    expect(despues).toBe(antes)
  })

  // ── RPC: la firma pide negocio_id, pero la función valida membresía ─────────

  test('registrar_venta rechaza vender en el negocio ajeno', async () => {
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { error } = await atk.rpc('registrar_venta', {
      p_negocio_id: victimaNegocioId,
      p_items: [{ producto_id: victimaProductoId, cantidad: 1 }],
      p_metodo_pago_id: atacanteMetodoId,
      p_cliente_id: null,
      p_pago_recibido: 100000,
      p_descuento: 0,
      p_vendedor_id: null,
      p_local_id: null,
    })
    expect(error, 'La DB debe rechazar vender en un negocio del que no eres miembro').not.toBeNull()
  })

  test('crear_apartado rechaza apartar en el negocio ajeno', async () => {
    test.skip(!victimaClienteId, 'La víctima no tiene clientes')
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { error } = await atk.rpc('crear_apartado', {
      p_negocio_id: victimaNegocioId,
      p_cliente_id: victimaClienteId,
      p_items: [{ producto_id: victimaProductoId, cantidad: 1 }],
      p_anticipo: 0,
    })
    expect(error).not.toBeNull()
  })

  test('cerrar_corte rechaza cerrar el corte ajeno', async () => {
    test.skip(!victimaCorteId, 'La víctima no tiene cortes')
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { error } = await atk.rpc('cerrar_corte', { p_corte_id: victimaCorteId, p_monto_contado: 0 })
    expect(error).not.toBeNull()
  })

  test('get_stock_por_plaza rechaza el negocio ajeno', async () => {
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { error } = await atk.rpc('get_stock_por_plaza', { p_negocio_id: victimaNegocioId })
    expect(error, 'Solo dueño/admin del negocio puede ver su stock por plaza').not.toBeNull()
  })

  test('get_turno_detalle no filtra el corte ajeno', async () => {
    test.skip(!victimaCorteId, 'La víctima no tiene cortes')
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { data, error } = await atk.rpc('get_turno_detalle', { p_corte_id: victimaCorteId })
    // O rechaza con error, o devuelve vacío — nunca datos del corte ajeno
    if (!error) expect(data ?? []).toHaveLength(0)
  })

  // ── SUPERADMIN: un dueño normal no debe poder invocar las RPC de plataforma ─

  test('[CRÍTICO] un dueño normal NO puede invocar sa_lista_negocios', async () => {
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { error } = await atk.rpc('sa_lista_negocios')
    expect(error, 'Solo un superadmin puede listar todos los negocios').not.toBeNull()
  })

  test('[CRÍTICO] un dueño normal NO puede invocar actualizar_modulos_negocio (activar módulos de paga gratis)', async () => {
    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { error } = await atk.rpc('actualizar_modulos_negocio', {
      p_negocio_id: atacanteNegocioId,
      p_modulos: { repartidores: true, variantes: true, apartados: true },
    })
    expect(error, 'Solo el superadmin activa módulos — si no, cualquiera los prende gratis').not.toBeNull()
  })

  // ── Gating de módulos de paga a nivel RPC (no solo UI) ──────────────────────

  test('[MONETIZACIÓN] con el módulo apartados APAGADO, crear_apartado falla en su propio negocio', async () => {
    // El negocio atacante es legítimo suyo, pero NO tiene el módulo apartados
    // (nace apagado y solo el superadmin lo activa). La RPC debe rechazarlo aun
    // siendo el dueño — si no, cualquiera usa el módulo de paga sin pagarlo.
    const admin = adminSupabase()
    const { data: prodPropio } = await admin
      .from('productos').insert({ negocio_id: atacanteNegocioId, nombre: 'Prod atk', precio_venta: 1000, precio_costo: 500, existencias: 5, activo: true })
      .select('id').single()
    const { data: cliPropio } = await admin
      .from('clientes').insert({ negocio_id: atacanteNegocioId, nombre: 'Cli atk', activo: true })
      .select('id').single()

    const atk = await userSupabase(ATACANTE.email, ATACANTE.password)
    const { error } = await atk.rpc('crear_apartado', {
      p_negocio_id: atacanteNegocioId,
      p_cliente_id: cliPropio!.id,
      p_items: [{ producto_id: prodPropio!.id, cantidad: 1 }],
      p_anticipo: 0,
    })
    expect(error, 'crear_apartado debe exigir el módulo activo').not.toBeNull()
    expect(error!.message).toMatch(/módulo|modulo|apartados/i)

    await admin.from('productos').update({ activo: false }).eq('id', prodPropio!.id)
    await admin.from('clientes').update({ activo: false }).eq('id', cliPropio!.id)
  })
})
