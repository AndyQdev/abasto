import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * Notificaciones push (10/11, pedido del ingeniero). Con el teléfono de Doña Rosa registrado en Conecta:
 * - cada paso de su pedido (confirmado, en preparación, en camino, entregado) le manda una notificación, todas con la
 *   misma etiqueta (una reemplaza a la otra) y «en camino» fija;
 * - una promoción del Superadmin le llega a todos los teléfonos.
 * Sin la cuenta de Firebase, Conecta corre en modo prueba: anota lo que mandaría y no sale a ningún teléfono. Lo que
 * se prueba aquí (qué se manda, a quién y cuándo) es igual en los dos modos.
 */
const CONECTA = 'http://localhost:8084';
const ROUTER = 'http://localhost:4000/';
const TOKEN = 'http://localhost:8180/realms/abasto/protocol/openid-connect/token';
const SUPERADMIN = 'http://localhost:5174';

async function tokenDe(request: APIRequestContext, correo: string) {
  const r = await request.post(TOKEN, { form: { grant_type: 'password', client_id: 'abasto-pruebas', username: correo, password: 'abasto123' } });
  return ((await r.json()) as { access_token: string }).access_token;
}

function grafoCon(request: APIRequestContext, token: string) {
  return async <T>(query: string, variables: Record<string, unknown> = {}): Promise<T> => {
    const r = await request.post(ROUTER, { headers: { authorization: `Bearer ${token}` }, data: { query, variables } });
    const cuerpo = (await r.json()) as { data?: T; errors?: { message: string }[] };
    if (cuerpo.errors?.length) throw new Error(cuerpo.errors.map((e) => e.message).join('; '));
    return cuerpo.data as T;
  };
}

interface Reciente {
  orgId: string;
  titulo: string;
  canal: string;
  datos: Record<string, string>;
  resultado: string;
}

async function recientes(request: APIRequestContext, admin: string): Promise<Reciente[]> {
  const r = await request.get(`${CONECTA}/v1/admin/notificaciones`, { headers: { authorization: `Bearer ${admin}` } });
  return ((await r.json()) as { recientes: Reciente[] }).recientes;
}

/** Un teléfono de mentira para esta corrida: Conecta lo trata como cualquier token de Firebase. */
const telefono = `e2e-${randomUUID()}-telefono-de-dona-rosa`;

test.afterAll(async ({ request }) => {
  const rosa = await tokenDe(request, 'donarosa@abasto.bo');
  await request.delete(`${CONECTA}/v1/dispositivos/${encodeURIComponent(telefono)}`, { headers: { authorization: `Bearer ${rosa}` } });
});

test('cada paso del pedido le avisa al teléfono de la tienda; «en camino» queda fija', async ({ request }) => {
  test.setTimeout(120_000);
  const rosa = await tokenDe(request, 'donarosa@abasto.bo');
  const admin = await tokenDe(request, 'admin@abasto.bo');
  const tienda = grafoCon(request, rosa);
  const abasto = grafoCon(request, await tokenDe(request, 'ventas@abasto.bo'));

  // La app registra el teléfono al entrar
  const registro = await request.put(`${CONECTA}/v1/dispositivos`, { headers: { authorization: `Bearer ${rosa}` }, data: { token: telefono, plataforma: 'android' } });
  expect(registro.ok()).toBe(true);
  const { miOrganizacion } = await tienda<{ miOrganizacion: { id: string } }>('query { miOrganizacion { id } }');

  const { crearPedido } = await tienda<{ crearPedido: { id: string; codigo: string } }>(
    `mutation($e: CrearPedidoEntrada!) { crearPedido(entrada: $e) { id codigo } }`,
    { e: { clave: randomUUID(), mayoristaId: 'abasto', metodoPago: 'CONTRA_ENTREGA', lineas: [{ productoId: 'AB-007', presentacion: 'DOCENA', cantidad: 1 }] } },
  );
  await expect
    .poll(async () => (await tienda<{ pedido: { estado: string } }>(`query($id: ID!) { pedido(id: $id) { estado } }`, { id: crearPedido.id })).pedido.estado, {
      timeout: 20_000,
    })
    .toBe('POR_CONFIRMAR');

  await abasto(`mutation($id: ID!) { confirmarPedido(id: $id) { estado } }`, { id: crearPedido.id });
  const avanzar = () => abasto(`mutation($id: ID!) { avanzarEntrega(id: $id) { estado } }`, { id: crearPedido.id });
  await avanzar(); // en preparación
  await avanzar(); // en camino

  const delPedido = async () => (await recientes(request, admin)).filter((n) => n.datos.pedidoId === crearPedido.id);
  await expect.poll(async () => (await delPedido()).map((n) => n.titulo), { timeout: 15_000 }).toContain('Tu pedido va en camino');

  await avanzar(); // entregado
  // Conecta atiende varios eventos a la vez: llegan los cuatro, en el orden que sea (en el teléfono uno reemplaza al otro)
  await expect
    .poll(async () => (await delPedido()).map((n) => n.titulo).sort(), { timeout: 15_000 })
    .toEqual(['Confirmaron tu pedido', 'Están preparando tu pedido', 'Tu pedido va en camino', '¡Llegó tu pedido!'].sort());

  const avisos = await delPedido();
  // Solo al teléfono de esa tienda, por el canal de pedidos, y cada una dice a dónde lleva al tocarla
  expect(new Set(avisos.map((n) => n.orgId))).toEqual(new Set([miOrganizacion.id]));
  expect(avisos.every((n) => n.canal === 'pedidos' && n.resultado === 'enviada')).toBe(true);
  expect(avisos.find((n) => n.titulo === 'Tu pedido va en camino')?.datos).toMatchObject({ tipo: 'pedido', estado: 'DESPACHADO', codigo: crearPedido.codigo });
});

test('Superadmin › Promociones: la promoción le llega a todos los teléfonos con la app', async ({ page, request }) => {
  test.setTimeout(120_000);
  const rosa = await tokenDe(request, 'donarosa@abasto.bo');
  await request.put(`${CONECTA}/v1/dispositivos`, { headers: { authorization: `Bearer ${rosa}` }, data: { token: telefono, plataforma: 'android' } });
  const titulo = `Aceite Fino a Bs 14 · ${Date.now().toString(36)}`;

  await page.goto(`${SUPERADMIN}/promociones`);
  await entrarComo(page, 'admin@abasto.bo');
  await expect(page.getByRole('heading', { name: 'Promociones' })).toBeVisible();
  await expect(page.getByText('Teléfonos con la app')).toBeVisible();

  await page.getByLabel('Título de la promoción').fill(titulo);
  await page.getByLabel('Mensaje de la promoción').fill('Solo este fin de semana. Pídelo hoy y te llega mañana.');
  await page.getByLabel('Producto de la promoción').selectOption('AB-007');
  // La vista previa muestra cómo se verá en el teléfono
  await expect(page.getByLabel('Así se ve en el teléfono')).toContainText(titulo);

  await page.getByRole('button', { name: /^Enviar a \d+ teléfono/ }).click();
  await expect(page.getByRole('alert')).toContainText('no se puede deshacer');
  await page.getByRole('button', { name: 'Sí, enviar' }).click();

  const enviada = page.getByRole('article', { name: `Promoción ${titulo}` });
  await expect(enviada).toContainText(/Llegó a/);
  await expect(enviada).toContainText('abre Sal fina Lobos 1 kg');

  // El teléfono de Doña Rosa estaba entre los que la recibieron, con el producto para abrir su ficha
  const admin = await tokenDe(request, 'admin@abasto.bo');
  const promo = (await recientes(request, admin)).find((n) => n.titulo === titulo);
  expect(promo).toMatchObject({ canal: 'promociones', resultado: 'enviada', datos: { tipo: 'promocion', productoId: 'AB-007' } });
});
