/**
 * Test j: APARTADOS (layaway) + VARIANTES + efecto en el CORTE DE CAJA.
 *
 * Cubre las migraciones 063 (variantes), 065 (apartados) y 066 (abonos en corte):
 *   crear apartado reserva stock FEFO → abonos hasta liquidar → cancelar
 *   restituye stock → los abonos en efectivo entran al corte abierto y
 *   cerrar_corte() los suma al monto esperado.
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { adminSupabase, userSupabase } from '../helpers/supa'
import { TEST_DUENO } from '../global-setup'

const FIXTURE = path.join(__dirname, '../.auth/fixture.json')
const AUTH_DUENO = path.join(__dirname, '../.auth/dueno.json')

async function stockDe(productoId: string): Promise<number> {
  const admin = adminSupabase()
  const { data } = await admin.from('productos').select('existencias').eq('id', productoId).single()
  return Number(data?.existencias ?? -1)
}

test.describe('Apartados con anticipo: ciclo completo', () => {
  let negocioId: string
  let duenoId: string
  let clienteId: string
  let clienteNombre: string
  let productoId: string          // producto simple, 10 pzas
  let playeraId: string           // producto con variantes Talla M/L, 5 pzas c/u
  let varianteMId: string
  let efectivoId: string | null = null
  let corteId: string
  let apartadoId: string          // el apartado principal del ciclo

  test.beforeAll(async () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    negocioId = fixture.negocioId
    duenoId = fixture.duenoId

    const admin = adminSupabase()

    // Cliente de prueba (un apartado siempre requiere cliente)
    clienteNombre = `Cliente Apartados E2E ${Date.now()}`
    const { data: cli, error: errCli } = await admin
      .from('clientes')
      .insert({ negocio_id: negocioId, nombre: clienteNombre, activo: true })
      .select('id').single()
    if (errCli) throw new Error(errCli.message)
    clienteId = cli.id

    // Producto simple con 10 pzas
    const { data: prod } = await admin
      .from('productos')
      .insert({ negocio_id: negocioId, nombre: `Apartado Test ${Date.now()}`, precio_venta: 10000, precio_costo: 6000, existencias: 0, activo: true })
      .select('id').single()
    productoId = prod!.id
    await admin.from('lotes_producto').insert({ negocio_id: negocioId, producto_id: productoId, cantidad: 10, cantidad_actual: 10 })

    // Producto con variantes: Playera Talla M / L, 5 pzas cada una
    const { data: playera } = await admin
      .from('productos')
      .insert({ negocio_id: negocioId, nombre: `Playera Var E2E ${Date.now()}`, precio_venta: 15000, precio_costo: 8000, existencias: 0, activo: true, tiene_variantes: true, atributo1: 'Talla' })
      .select('id').single()
    playeraId = playera!.id
    const { data: vars } = await admin
      .from('variantes_producto')
      .insert([
        { negocio_id: negocioId, producto_id: playeraId, valor1: 'M' },
        { negocio_id: negocioId, producto_id: playeraId, valor1: 'L' },
      ])
      .select('id, valor1')
    varianteMId = vars!.find((v) => v.valor1 === 'M')!.id
    for (const v of vars!) {
      await admin.from('lotes_producto').insert({ negocio_id: negocioId, producto_id: playeraId, variante_id: v.id, cantidad: 5, cantidad_actual: 5 })
    }

    // Método de pago Efectivo del negocio
    const { data: metodo } = await admin
      .from('metodos_pago').select('id').eq('negocio_id', negocioId).ilike('nombre', 'efectivo').eq('activo', true).maybeSingle()
    efectivoId = metodo?.id ?? null

    // Corte de caja fresco para verificar que los abonos entran al corte
    await admin.from('cortes_caja')
      .update({ estado: 'cerrado', fecha_cierre: new Date().toISOString(), monto_contado: 0, diferencia: 0, monto_esperado: 0 })
      .eq('negocio_id', negocioId).eq('estado', 'abierto')
    const { data: corte, error: errCorte } = await admin.from('cortes_caja')
      .insert({ negocio_id: negocioId, abierto_por: duenoId, monto_inicial: 10000 })
      .select('id').single()
    if (errCorte) throw new Error(errCorte.message)
    corteId = corte.id
  })

  test.afterAll(async () => {
    const admin = adminSupabase()
    // Cerrar el corte si algún test falló antes de cerrarlo
    await admin.from('cortes_caja')
      .update({ estado: 'cerrado', fecha_cierre: new Date().toISOString(), monto_contado: 0, diferencia: 0, monto_esperado: 0 })
      .eq('id', corteId).eq('estado', 'abierto')
    // Desactivar productos y cliente de prueba
    if (productoId) await admin.from('productos').update({ activo: false }).eq('id', productoId)
    if (playeraId) await admin.from('productos').update({ activo: false }).eq('id', playeraId)
    if (clienteId) await admin.from('clientes').update({ activo: false }).eq('id', clienteId)
  })

  test('apartado sin cliente es rechazado por la DB', async () => {
    const dueno = await userSupabase(TEST_DUENO.email, TEST_DUENO.password)
    const { error } = await dueno.rpc('crear_apartado', {
      p_negocio_id: negocioId,
      p_cliente_id: null,
      p_items: [{ producto_id: productoId, cantidad: 1 }],
      p_anticipo: 0,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/cliente/i)
  })

  test('crear apartado con anticipo reserva stock y registra el abono en el corte', async () => {
    expect(await stockDe(productoId)).toBe(10)

    const dueno = await userSupabase(TEST_DUENO.email, TEST_DUENO.password)
    const { data, error } = await dueno.rpc('crear_apartado', {
      p_negocio_id: negocioId,
      p_cliente_id: clienteId,
      p_items: [{ producto_id: productoId, cantidad: 2 }],   // 2 × $100 = $200
      p_anticipo: 5000,                                       // $50 de anticipo
      p_metodo_pago_id: efectivoId,
      p_fecha_limite: null,
      p_notas: 'Apartado E2E',
    })
    expect(error, `crear_apartado falló: ${error?.message}`).toBeNull()
    apartadoId = data as string

    // Stock reservado
    expect(await stockDe(productoId)).toBe(8)

    const admin = adminSupabase()
    const { data: ap } = await admin
      .from('apartados').select('estado, total, cliente_nombre').eq('id', apartadoId).single()
    expect(ap?.estado).toBe('activo')
    expect(ap?.total).toBe(20000)
    expect(ap?.cliente_nombre).toBe(clienteNombre)

    // El abono del anticipo quedó ligado al corte abierto (trigger de la 066)
    const { data: abonos } = await admin
      .from('apartado_abonos').select('monto, corte_id').eq('apartado_id', apartadoId)
    expect(abonos?.length).toBe(1)
    expect(abonos![0].monto).toBe(5000)
    expect(abonos![0].corte_id).toBe(corteId)
  })

  test('abonar el resto liquida el apartado', async () => {
    const dueno = await userSupabase(TEST_DUENO.email, TEST_DUENO.password)

    // Abono parcial
    const { error: err1 } = await dueno.rpc('abonar_apartado', {
      p_apartado_id: apartadoId, p_monto: 7000, p_metodo_pago_id: efectivoId,
    })
    expect(err1, err1?.message).toBeNull()

    const admin = adminSupabase()
    let { data: ap } = await admin.from('apartados').select('estado').eq('id', apartadoId).single()
    expect(ap?.estado).toBe('activo')

    // Abono final (5000 + 7000 + 8000 = 20000 = total)
    const { error: err2 } = await dueno.rpc('abonar_apartado', {
      p_apartado_id: apartadoId, p_monto: 8000, p_metodo_pago_id: efectivoId,
    })
    expect(err2, err2?.message).toBeNull()

    ;({ data: ap } = await admin.from('apartados').select('estado, cerrado_en').eq('id', apartadoId).single())
    expect(ap?.estado).toBe('liquidado')

    // Un apartado liquidado ya no admite abonos
    const { error: err3 } = await dueno.rpc('abonar_apartado', {
      p_apartado_id: apartadoId, p_monto: 1000, p_metodo_pago_id: efectivoId,
    })
    expect(err3).not.toBeNull()
  })

  test('la página /apartados muestra el apartado liquidado', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_DUENO })
    const page = await ctx.newPage()
    await page.goto('/apartados')
    await expect(page.getByRole('heading', { name: 'Apartados' })).toBeVisible()
    await expect(page.getByText(clienteNombre).first()).toBeVisible()
    await expect(page.getByText('Liquidado').first()).toBeVisible()
    await ctx.close()
  })

  test('producto con variantes exige variante; apartar talla M descuenta solo esa talla', async () => {
    const dueno = await userSupabase(TEST_DUENO.email, TEST_DUENO.password)

    // Sin variante → rechazado
    const { error: errSin } = await dueno.rpc('crear_apartado', {
      p_negocio_id: negocioId,
      p_cliente_id: clienteId,
      p_items: [{ producto_id: playeraId, cantidad: 1 }],
      p_anticipo: 0,
    })
    expect(errSin).not.toBeNull()
    expect(errSin!.message).toMatch(/variante/i)

    // Con talla M → descuenta la variante M, la L queda intacta
    const { data: apVarId, error } = await dueno.rpc('crear_apartado', {
      p_negocio_id: negocioId,
      p_cliente_id: clienteId,
      p_items: [{ producto_id: playeraId, variante_id: varianteMId, cantidad: 2 }],
      p_anticipo: 0,
    })
    expect(error, error?.message).toBeNull()

    const admin = adminSupabase()
    const { data: vars } = await admin
      .from('variantes_producto').select('valor1, existencias').eq('producto_id', playeraId)
    const porTalla = Object.fromEntries(vars!.map((v) => [v.valor1, Number(v.existencias)]))
    expect(porTalla['M']).toBe(3)
    expect(porTalla['L']).toBe(5)

    // El item guarda el snapshot de la variante
    const { data: items } = await admin
      .from('apartado_items').select('variante_texto').eq('apartado_id', apVarId as string)
    expect(items![0].variante_texto).toBe('M')

    // Cancelar → la talla M recupera sus piezas
    const { error: errCancel } = await dueno.rpc('cancelar_apartado', { p_apartado_id: apVarId as string })
    expect(errCancel, errCancel?.message).toBeNull()

    const { data: varsDespues } = await admin
      .from('variantes_producto').select('valor1, existencias').eq('producto_id', playeraId)
    const porTallaDespues = Object.fromEntries(varsDespues!.map((v) => [v.valor1, Number(v.existencias)]))
    expect(porTallaDespues['M']).toBe(5)
  })

  test('cerrar_corte suma los abonos de apartado en efectivo (mig. 066)', async () => {
    test.skip(!efectivoId, 'El negocio no tiene método de pago Efectivo')

    const dueno = await userSupabase(TEST_DUENO.email, TEST_DUENO.password)
    const { data, error } = await dueno.rpc('cerrar_corte', {
      p_corte_id: corteId,
      p_monto_contado: 30000, // 10000 inicial + 20000 de abonos en efectivo
    })
    expect(error, `cerrar_corte falló: ${error?.message}`).toBeNull()

    const resumen = data as { abonos_apartado: number; monto_esperado: number; diferencia: number }
    // Los 3 abonos en efectivo del ciclo: 5000 + 7000 + 8000
    expect(resumen.abonos_apartado).toBe(20000)
    expect(resumen.monto_esperado).toBe(30000)
    expect(resumen.diferencia).toBe(0)
  })
})
