import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * CU-09 · Registrar un pago de una cuenta por cobrar, de punta a punta:
 * Los Pozos confirma el pedido a crédito A-1051 de Almacén Mery (Pedidos publica pedido.confirmado) → Cobros abre la
 * cuenta → el Panel la muestra en Cuentas → se cobra una parte en efectivo y después el resto por transferencia.
 * e2e/preparar.ts deja A-1051 por confirmar y sin cuenta antes de cada corrida.
 */
test('CU-09: la venta a crédito confirmada aparece en Cuentas y se cobra en dos pagos', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('http://localhost:5170/pedidos');
  await entrarComo(page, 'lospozos@abasto.bo');

  const tarjeta = page.getByRole('article', { name: 'Pedido A-1051' });
  await tarjeta.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('article', { name: 'Pedido A-1051' }).getByRole('button', { name: 'Confirmar' })).toHaveCount(0);

  // La cuenta la abre Cobros al recibir el evento: puede tardar un momento
  await page.getByRole('link', { name: 'Cuentas' }).first().click().catch(() => page.goto('http://localhost:5170/cuentas'));
  if (!page.url().includes('/cuentas')) await page.goto('http://localhost:5170/cuentas');
  const cuenta = page.getByRole('button', { name: 'Cuenta A-1051' });
  await expect(async () => {
    await page.reload();
    await expect(cuenta).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 40_000 });
  await expect(cuenta).toContainText('Almacén Mery');
  await expect(cuenta).toContainText('A crédito');

  // Primer pago: una parte, en efectivo
  await cuenta.click();
  const panel = page.getByRole('dialog', { name: 'Cuenta A-1051' });
  const monto = panel.getByLabel('¿Cuánto te pagó?');
  await monto.fill('9.999.999');
  await expect(panel.getByText('no puedes cobrar más')).toBeVisible();
  await monto.fill('10');
  await panel.getByRole('button', { name: 'Efectivo' }).click();
  await panel.getByLabel('Nota (opcional)').fill('Adelanto en el mostrador');
  await panel.getByRole('button', { name: 'Registrar Bs 10,00' }).click();
  await expect(page.getByText(/Registraste Bs 10,00 de Almacén Mery: todavía debe/)).toBeVisible();
  await expect(panel).toHaveCount(0);

  // Segundo pago: el resto, por transferencia
  await cuenta.click();
  await expect(panel.getByText('Adelanto en el mostrador')).toBeVisible();
  await panel.getByRole('button', { name: /^Todo · / }).click();
  await panel.getByRole('button', { name: 'Transferencia' }).click();
  await panel.getByRole('button', { name: /^Registrar Bs / }).click();
  await expect(page.getByText('Almacén Mery terminó de pagar A-1051')).toBeVisible();

  // Ya no está entre lo que se debe, y aparece en Pagadas
  await expect(page.getByRole('button', { name: 'Cuenta A-1051' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pagadas' }).click();
  await expect(page.getByRole('button', { name: 'Cuenta A-1051' })).toContainText('Pagada');
});
