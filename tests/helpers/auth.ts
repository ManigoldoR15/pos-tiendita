import { type Page } from '@playwright/test'

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="contrasena"]', password)
  await page.click('button[type="submit"]')
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 })
}

export async function logout(page: Page) {
  // Find logout button (form action logoutAction)
  const logoutBtn = page.locator('button[aria-label="Salir"], form[action] button').filter({ hasText: /salir|cerrar/i })
  if (await logoutBtn.count() > 0) {
    await logoutBtn.first().click()
    await page.waitForURL(/login/, { timeout: 8000 })
  } else {
    // Try nav menu
    await page.goto('/login')
  }
}
