import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as XLSX from 'xlsx'

const DUENO = path.join(__dirname, '../.auth/dueno.json')
const EMPLEADO = path.join(__dirname, '../.auth/empleado.json')

/**
 * El respaldo existe porque la base vive en un plan sin respaldos automáticos:
 * cada dueño se lleva su información a su propio dispositivo. Si esto se rompe
 * en silencio, nadie se entera hasta el día que hace falta.
 */
test.describe('Respaldo descargable del negocio', () => {
  test.describe('como dueño', () => {
    test.use({ storageState: DUENO })

    test('la tarjeta de respaldo aparece en Configuración', async ({ page }) => {
      await page.goto('/configuracion')
      await expect(page.getByRole('heading', { name: /Respaldo de tus datos/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Descargar respaldo/i })).toBeVisible()
      // Sin respaldo previo en este navegador, lo advierte
      await expect(page.getByText(/Todavía no has descargado ningún respaldo/i)).toBeVisible()
    })

    test('el archivo baja con las hojas y los datos del negocio', async ({ page }) => {
      await page.goto('/configuracion')
      const [descarga] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /Descargar respaldo/i }).click(),
      ])

      expect(descarga.suggestedFilename()).toMatch(/^respaldo-.*\.xlsx$/)

      const ruta = await descarga.path()
      const wb = XLSX.readFile(ruta)
      // Las hojas que sostienen el negocio
      for (const hoja of ['Resumen', 'Productos', 'Ventas', 'Detalle de ventas', 'Clientes', 'Gastos', 'Cortes de caja']) {
        expect(wb.SheetNames).toContain(hoja)
      }

      // Y traen datos de verdad, no hojas vacías
      const productos = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Productos'])
      expect(productos.length).toBeGreaterThan(0)
      expect(productos[0]).toHaveProperty('Nombre')
      // Los montos van en pesos, no en centavos: un precio de catálogo es < 100000
      expect(Number(productos[0]['Precio venta'])).toBeLessThan(100000)
    })

    test('tras descargar, recuerda la fecha en el dispositivo', async ({ page }) => {
      await page.goto('/configuracion')
      await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /Descargar respaldo/i }).click(),
      ])
      await page.reload()
      await expect(page.getByText(/Último respaldo en este dispositivo: hoy/i)).toBeVisible()
    })
  })

  test.describe('como empleado', () => {
    test.use({ storageState: EMPLEADO })

    test('no puede descargar el negocio completo', async ({ page }) => {
      const res = await page.request.get('/api/export/respaldo')
      expect(res.status()).toBe(403)

      await page.goto('/configuracion')
      // Ni siquiera ve la tarjeta (configuración lo redirige, pero por si acaso)
      await expect(page.getByRole('heading', { name: /Respaldo de tus datos/i })).toHaveCount(0)
    })
  })
})
