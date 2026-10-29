import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * El Panel es una PWA: sin señal muestra lo último que vio y guarda los cambios para mandarlos después.
 * Solo el build tiene service worker; con pnpm dev:panel corriendo esta prueba se salta.
 */
test('sin señal el Panel sigue mostrando los pedidos y deja el cambio en cola', async ({ page, context }) => {
  await page.goto('http://localhost:5170/inicio');
  await entrarComo(page, 'lospozos@abasto.bo');
  await expect(page.getByText('Despensa Lupita').first()).toBeVisible();

  const conServiceWorker = await page.evaluate(async () => {
    const registro = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 5000))]);
    return registro !== null;
  });
  test.skip(!conServiceWorker, 'el Shell corre con pnpm dev:panel, sin service worker');
  // Con el service worker al mando, una vuelta con señal deja guardados el Shell, los remotos y las consultas
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.reload();
  await expect(page.getByText('Despensa Lupita').first()).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Sin conexión: ves los últimos datos guardados')).toBeVisible();
  await expect(page.getByText('Despensa Lupita').first()).toBeVisible();

  await page.getByRole('button', { name: 'Confirmar' }).first().click();
  await expect(page.getByText('tu cambio quedó guardado y se enviará solo cuando vuelva la señal')).toBeVisible();
  await expect(page.getByText('1 cambios esperando para enviarse')).toBeVisible();

  // No se manda: los pedidos de demostración los usan las demás pruebas. El envío lo prueba offline.spec.ts
  await page.evaluate(
    () =>
      new Promise((listo) => {
        const borrar = indexedDB.deleteDatabase('abasto-panel-bandeja');
        borrar.onsuccess = borrar.onerror = borrar.onblocked = () => listo(null);
      }),
  );
  await context.setOffline(false);
});
