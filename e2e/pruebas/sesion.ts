import type { Page } from '@playwright/test';

/** Inicia sesión en la pantalla de Keycloak (la misma para todas las apps). */
export async function entrarComo(page: Page, correo: string, clave = 'abasto123') {
  await page.locator('#username').fill(correo);
  await page.locator('#password').fill(clave);
  await page.locator('#kc-login').click();
}
