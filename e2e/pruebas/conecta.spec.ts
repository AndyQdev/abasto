import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * Conecta (F3): lo que entra de afuera queda en la bitácora del mayorista y se ve en Panel › Conecta.
 * El mismo mensaje de WhatsApp llega dos veces (como cuando WhatsApp reintenta): entra un solo pedido y el segundo
 * aparece como «Repetido: no se duplicó». Un pedido con una presentación que no existe aparece con el motivo.
 */
const CONECTA = 'http://localhost:8084';
const TOKEN = 'http://localhost:8180/realms/abasto/protocol/openid-connect/token';

async function tokenDe(request: APIRequestContext, correo: string) {
  const r = await request.post(TOKEN, { form: { grant_type: 'password', client_id: 'abasto-pruebas', username: correo, password: 'abasto123' } });
  return ((await r.json()) as { access_token: string }).access_token;
}

test('Conecta: el pedido de WhatsApp repetido entra una sola vez y el Panel lo muestra', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await tokenDe(request, 'donarosa@abasto.bo');
  const enviar = (clave: string, productoId: string, presentacion = 'UNIDAD') =>
    request.post(`${CONECTA}/v1/pedidos`, {
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': clave, 'x-abasto-origen': 'whatsapp' },
      data: { mayoristaId: 'abasto', metodoPago: 'CONTRA_ENTREGA', lineas: [{ productoId, presentacion, cantidad: 1 }] },
    });

  const clave = randomUUID();
  const primera = (await (await enviar(clave, 'AB-101')).json()) as { estado: string; respuesta: { codigo: string } };
  const segunda = (await (await enviar(clave, 'AB-101')).json()) as { estado: string; respuesta: { codigo: string } };
  expect(primera.estado).toBe('aplicada');
  expect(segunda.estado).toBe('repetida');
  expect(segunda.respuesta.codigo).toBe(primera.respuesta.codigo);
  const codigo = primera.respuesta.codigo;

  // Una presentación que no existe: el Router lo rechaza y Conecta lo anota con el motivo
  const mala = (await (await enviar(randomUUID(), 'AB-101', 'BOLSA')).json()) as { estado: string };
  expect(mala.estado).toBe('rechazada');

  await page.goto('http://localhost:5170/conecta');
  await entrarComo(page, 'ventas@abasto.bo');
  const delPedido = page.getByRole('article', { name: `${codigo} por WhatsApp` });
  await expect(delPedido).toHaveCount(2);
  await expect(delPedido.filter({ hasText: 'Repetido: no se duplicó' })).toHaveCount(1);
  await expect(delPedido.filter({ hasText: 'Pedido creado' })).toHaveCount(1);
  await expect(delPedido.first()).toContainText('Tienda Doña Rosa');

  // Lo que no entró se ve con su motivo, y el filtro lo separa
  await page.getByRole('button', { name: /Con problemas/ }).click();
  await expect(page.getByRole('article').first()).toContainText('No entró');

  // «Ver pedido» lleva a Pedidos con el código buscado
  await page.getByRole('button', { name: /Con problemas/ }).click();
  await delPedido.filter({ hasText: 'Pedido creado' }).getByRole('button', { name: 'Ver pedido' }).click();
  await expect(page).toHaveURL(new RegExp(`/pedidos\\?q=${codigo}`));
  await expect(page.getByRole('article', { name: `Pedido ${codigo}` })).toBeVisible();
});
