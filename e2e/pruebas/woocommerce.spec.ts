import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * CU-10 con un WooCommerce de verdad: el plugin importa el catálogo y un pedido de la tienda llega a Abasto sin
 * duplicarse aunque WooCommerce avise dos veces; cuando el mayorista confirma, queda una nota en el pedido.
 * Necesita `pnpm woocommerce`, por eso solo corre con WOOCOMMERCE=1.
 */
const CONECTA = 'http://localhost:8084';
const ROUTER = 'http://localhost:4000/';
const TOKEN = 'http://localhost:8180/realms/abasto/protocol/openid-connect/token';
const SITIO = 'http://host.docker.internal:8095';
const COMPOSE = resolve(process.cwd(), '..', 'plugins', 'woocommerce-abasto', 'docker-compose.yml');

const wp = (...args: string[]) =>
  execFileSync('docker', ['compose', '-f', COMPOSE, '-p', 'abasto-woo', 'run', '--rm', 'woo-cli', 'wp', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

async function tokenDe(request: APIRequestContext, correo: string) {
  const r = await request.post(TOKEN, { form: { grant_type: 'password', client_id: 'abasto-pruebas', username: correo, password: 'abasto123' } });
  return ((await r.json()) as { access_token: string }).access_token;
}

test.skip(!process.env.WOOCOMMERCE, 'Necesita pnpm woocommerce y WOOCOMMERCE=1');
// El sitio tiene una sola dirección, la que alcanza Conecta desde su contenedor; el navegador la resuelve a esta máquina
test.use({ launchOptions: { args: ['--host-resolver-rules=MAP host.docker.internal 127.0.0.1'] } });

test('el plugin importa el catálogo, manda el pedido una sola vez y recibe los avisos', async ({ page, request }) => {
  test.setTimeout(240_000);
  const sesion = await tokenDe(request, 'donarosa@abasto.bo');
  const con = { authorization: `Bearer ${sesion}` };

  // Se puede repetir: lo importado en otra corrida se borra para volver a probar el precio inicial
  const anteriores = wp('post', 'list', '--post_type=product', '--post_status=any', '--format=ids').split(/\s+/).filter(Boolean);
  if (anteriores.length) wp('post', 'delete', ...anteriores, '--force');

  // La tienda saca su llave en la app y la pega en el plugin
  for (const l of (await (await request.get(`${CONECTA}/v1/llaves`, { headers: con })).json()) as { id: string }[]) {
    await request.delete(`${CONECTA}/v1/llaves/${l.id}`, { headers: con });
  }
  for (const w of (await (await request.get(`${CONECTA}/v1/webhooks`, { headers: con })).json()) as { id: string }[]) {
    await request.delete(`${CONECTA}/v1/webhooks/${w.id}`, { headers: con });
  }
  const { llave } = (await (await request.post(`${CONECTA}/v1/llaves`, { headers: con, data: { nombre: 'WooCommerce de prueba' } })).json()) as { llave: string };
  wp('option', 'update', 'abasto_api', 'http://host.docker.internal:8084');
  wp('option', 'update', 'abasto_llave', llave);
  wp('option', 'update', 'abasto_margen', '20');
  wp('option', 'delete', 'abasto_id_aviso');

  // La pantalla de ajustes, en el navegador: prende los avisos como lo haría la tienda
  await page.goto(`${SITIO}/wp-login.php`);
  await page.getByLabel('Nombre de usuario o correo electrónico').or(page.getByLabel('Username or Email Address')).fill('admin');
  await page.locator('#user_pass').fill('admin');
  await page.locator('#wp-submit').click();
  await page.goto(`${SITIO}/wp-admin/admin.php?page=abasto`);
  await expect(page.getByRole('heading', { name: '2. Trae el catálogo' })).toBeVisible();
  await expect(page.locator('#abasto_mayorista option', { hasText: 'Abasto' })).toHaveCount(1);
  // La llave guardada nunca vuelve a la pantalla
  expect(await page.content()).not.toContain(llave);
  await page.getByRole('button', { name: 'Prender avisos' }).click();
  await expect(page.getByText('Listo: cada cambio de un pedido en Abasto')).toBeVisible();

  // Importa desde la pantalla: entra como borrador
  await page.locator('#abasto_mayorista').selectOption({ label: 'Abasto' });
  await page.locator('#abasto_busqueda').fill('harina');
  await page.getByRole('button', { name: 'Importar' }).click();
  await expect(page.getByText(/Importados: \d+ nuevos|Importados: 0 nuevos como borrador y \d+ actualizados/)).toBeVisible();

  const ids = wp('post', 'list', '--post_type=product', '--post_status=any', '--meta_key=_abasto_producto_id', '--format=ids').split(/\s+/).filter(Boolean);
  expect(ids.length).toBeGreaterThan(0);
  const producto = ids[0] as string;
  expect(wp('post', 'get', producto, '--field=post_status')).toMatch(/draft|publish/);
  const productoAbasto = wp('post', 'meta', 'get', producto, '_abasto_producto_id');
  const presentacion = wp('post', 'meta', 'get', producto, '_abasto_presentacion');
  expect(productoAbasto).toMatch(/^AB-/);
  expect(presentacion).toMatch(/UNIDAD|CUARTA|DOCENA|CAJA|FARDO/);
  // El precio de venta se calculó con el margen, sobre lo que cuesta la presentación
  const costo = Number(wp('post', 'meta', 'get', producto, '_abasto_costo_centavos'));
  expect(Number(wp('post', 'meta', 'get', producto, '_regular_price'))).toBeCloseTo((costo * 1.2) / 100, 2);

  // Volver a importar no pisa el precio que la tienda cambió a mano
  wp('wc', 'product', 'update', producto, '--regular_price=999', '--user=admin');
  wp('abasto', 'importar', 'abasto', '--busqueda=harina');
  expect(wp('post', 'meta', 'get', producto, '_regular_price')).toBe('999');
  wp('post', 'update', producto, '--post_status=publish');

  // Un cliente compra en la tienda; también lleva algo propio, que no va a Abasto
  const propio = wp('wc', 'product', 'create', '--name=Bolsa de la tienda', '--regular_price=2', '--user=admin', '--porcelain');
  const pedidoWoo = wp(
    'wc', 'shop_order', 'create', '--user=admin', '--porcelain', '--status=pending',
    `--line_items=[{"product_id":${producto},"quantity":2},{"product_id":${propio},"quantity":1}]`,
    '--billing={"first_name":"Ana","address_1":"Av. Banzer 123","city":"Santa Cruz","email":"ana@ejemplo.bo"}',
    '--shipping={"address_1":"Av. Banzer 123","city":"Equipetrol"}',
  );

  // Pasa a «en proceso» y queda como enviado a Abasto
  wp('wc', 'shop_order', 'update', pedidoWoo, '--status=processing', '--user=admin');
  const metaDelPedido = () => JSON.parse(wp('wc', 'shop_order', 'get', pedidoWoo, '--field=meta_data', '--format=json', '--user=admin')) as { key: string; value: Record<string, { id: string; codigo: string }> }[];
  const enviados = metaDelPedido().find((m) => m.key === '_abasto_pedidos')?.value;
  const enviado = enviados?.['abasto'];
  if (!enviado) throw new Error('El pedido no se envió a Abasto');
  expect(enviado.codigo).toMatch(/^A-/);

  // El pedido en Abasto: solo lo de Abasto, con la cantidad y la dirección de la tienda
  const leer = async () => (await (await request.get(`${CONECTA}/v1/pedidos/${enviado.id}`, { headers: con })).json()) as { codigo: string; estado: string; lineas: { cantidad: number; presentacion: string; producto: { id: string } }[] };
  const enAbasto = await leer();
  expect(enAbasto.lineas).toHaveLength(1);
  expect(enAbasto.lineas[0]).toMatchObject({ cantidad: 2, presentacion, producto: { id: productoAbasto } });

  // WooCommerce vuelve a avisar (pasa a completado): no se crea otro
  const antes = ((await (await request.get(`${CONECTA}/v1/pedidos`, { headers: con })).json()) as unknown[]).length;
  wp('wc', 'shop_order', 'update', pedidoWoo, '--status=completed', '--user=admin');
  const despues = ((await (await request.get(`${CONECTA}/v1/pedidos`, { headers: con })).json()) as unknown[]).length;
  expect(despues).toBe(antes);

  // El mayorista confirma: el aviso firmado llega al plugin y queda como nota en el pedido
  const notas = () => (JSON.parse(wp('wc', 'order_note', 'list', pedidoWoo, '--user=admin', '--fields=note', '--format=json')) as { note: string }[]).map((n) => n.note).join(' | ');
  const mayorista = await tokenDe(request, 'ventas@abasto.bo');
  await expect
    .poll(
      async () => {
        const r = await request.post(ROUTER, { headers: { authorization: `Bearer ${mayorista}` }, data: { query: 'mutation($id: ID!) { confirmarPedido(id: $id) { estado } }', variables: { id: enviado.id } } });
        return ((await r.json()) as { data?: { confirmarPedido?: { estado: string } } }).data?.confirmarPedido?.estado;
      },
      { timeout: 30_000, intervals: [1000, 2000] },
    )
    .toBe('CONFIRMADO');
  await expect
    .poll(notas, { timeout: 40_000, intervals: [3000] })
    .toContain(`Abasto ${enviado.codigo}: el mayorista confirmó el pedido.`);

  // Un aviso sin firma no entra
  const sinFirma = await request.post('http://127.0.0.1:8095/wp-json/abasto/v1/avisos', {
    headers: { host: 'host.docker.internal:8095' },
    data: { tipo: 'pedido.confirmado', datos: { pedidoId: enviado.id, codigo: 'FALSO' } },
  });
  expect(sinFirma.status()).toBe(401);
  expect(notas()).not.toContain('FALSO');

  // Se revoca la llave: el plugin explica qué pasa en vez de fallar callado
  const llaves = (await (await request.get(`${CONECTA}/v1/llaves`, { headers: con })).json()) as { id: string }[];
  for (const l of llaves) await request.delete(`${CONECTA}/v1/llaves/${l.id}`, { headers: con });
  await page.goto(`${SITIO}/wp-admin/admin.php?page=abasto`);
  await expect(page.getByText('Abasto no reconoce la llave')).toBeVisible();
});
