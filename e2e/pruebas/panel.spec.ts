import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

test.describe('Panel Mayorista', () => {
  test('el Shell (React) carga Gestión (Angular) e Inteligencia (Vue) con la misma sesión', async ({ page }) => {
    await page.goto('http://localhost:5170/inicio');
    await entrarComo(page, 'lospozos@abasto.bo');

    // Gestión en Angular, dentro de su Shadow DOM: GraphQL federado trae el pedido (Spring) y la tienda (Laravel)
    await expect(page.getByText('Hola, Distribuidora Los Pozos')).toBeVisible();
    await expect(page.getByText('Pedidos por confirmar')).toBeVisible();
    await expect(page.getByText('Despensa Lupita')).toBeVisible();

    // Inteligencia en Vue: el Shell cambia de remoto sin recargar la página
    // (una marca en window sobrevive a pushState pero no a una recarga)
    await page.evaluate(() => ((window as unknown as { sinRecargar: boolean }).sinRecargar = true));
    await page.getByRole('link', { name: 'Reportes' }).click();
    await expect(page.getByText('Reportes e inteligencia')).toBeVisible();
    await expect(page).toHaveURL('http://localhost:5170/reportes');
    expect(await page.evaluate(() => (window as unknown as { sinRecargar?: boolean }).sinRecargar)).toBe(true);
  });

  test('reporte generativo: la pregunta se responde con datos de la empresa y sale en Excel', async ({ page }) => {
    await page.goto('http://localhost:5170/reportes');
    await entrarComo(page, 'lospozos@abasto.bo');

    // Reportes es un chat: la pregunta va abajo y el reporte se arma en la mesa de trabajo, en su pestaña
    await page.getByRole('textbox', { name: 'Pregunta algo sobre tus datos' }).fill('¿Qué tiendas me tienen que pagar mañana?');
    await page.getByRole('button', { name: 'Preguntar' }).click();
    await expect(page.getByRole('tab', { name: /Qué tiendas me tienen que pagar/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Tienda Doña Rosa' })).toBeVisible();

    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar a Excel' }).click();
    expect((await descarga).suggestedFilename()).toMatch(/\.xlsx$/);
  });
});

test('una sola cuenta: del Panel al Superadmin sin volver a escribir la contraseña', async ({ page }) => {
  // ventas@abasto.bo es Abasto: vende en el Panel y administra en el Superadmin
  await page.goto('http://localhost:5170/inicio');
  await entrarComo(page, 'ventas@abasto.bo');
  await expect(page.getByText('Hola, Abasto')).toBeVisible();

  await page.goto('http://localhost:5174/traccion');
  await expect(page.locator('#password')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tracción' })).toBeVisible();
});
