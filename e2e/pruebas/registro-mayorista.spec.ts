import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * CU-01 de punta a punta: un mayorista se registra solo en el Panel, entra y ve que está en revisión;
 * Abasto lo verifica en el Superadmin y el aviso desaparece.
 */
test('CU-01: registrarse como mayorista, quedar en revisión y que Abasto lo verifique', async ({ page, browser }) => {
  const sufijo = Date.now().toString().slice(-7);
  const empresa = `Distribuidora Prueba ${sufijo}`;
  const correo = `cu01-${sufijo}@prueba.bo`;
  const clave = 'Prueba.2026';

  // 1. El formulario es público y avisa qué falta antes de enviar
  await page.goto('http://localhost:5170/registro');
  await expect(page.getByRole('heading', { name: 'Vende al por mayor a las tiendas de tu ciudad' })).toBeVisible();
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByText('El NIT tiene entre 6 y 12 dígitos')).toBeVisible();

  await page.getByLabel('Nombre de la empresa').fill(empresa);
  await page.getByLabel('NIT').fill(`10${sufijo}`);
  await page.getByLabel('Representante (nombre y apellido)').fill('Ana Prueba');
  await page.getByLabel('Celular').fill('71234567');
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña para entrar al Panel').fill(clave);
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByRole('heading', { name: 'Recibimos tu solicitud' })).toBeVisible();

  // 2. Entra al Panel con lo que eligió y ve que está en revisión
  await page.getByRole('link', { name: /Entrar al Panel/ }).click();
  await entrarComo(page, correo, clave);
  await expect(page.getByText('Tu empresa está en revisión')).toBeVisible();

  // 3. Abasto lo verifica en el Superadmin (otra sesión: la del admin)
  const admin = await (await browser.newContext()).newPage();
  await admin.goto('http://localhost:5174/mayoristas');
  await entrarComo(admin, 'admin@abasto.bo');
  const tarjeta = admin.locator('article', { hasText: empresa });
  await expect(tarjeta).toContainText('Por verificar');
  await expect(tarjeta).toContainText(`10${sufijo}`);
  await tarjeta.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(admin.getByText(`${empresa} quedó verificado`)).toBeVisible();
  await admin.getByRole('tab', { name: 'Verificados' }).click();
  await expect(admin.locator('article', { hasText: empresa })).toContainText('Verificado');

  // 4. En el Panel ya no aparece el aviso
  await page.reload();
  await expect(page.getByText('Hola,')).toBeVisible();
  await expect(page.getByText('Tu empresa está en revisión')).toHaveCount(0);
});
