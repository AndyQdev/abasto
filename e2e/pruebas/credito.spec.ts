import { execSync } from 'node:child_process';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * CU-04: el mayorista aprueba a una tienda en Panel › Clientes con lista de precios y crédito, y la tienda ya puede
 * comprar a crédito con ese cupo. Después lo cambia desde la tarjeta del cliente.
 */
const ROUTER = 'http://localhost:4000/';
const TOKEN = 'http://localhost:8180/realms/abasto/protocol/openid-connect/token';

async function tokenDe(request: APIRequestContext, correo: string) {
  const r = await request.post(TOKEN, { form: { grant_type: 'password', client_id: 'abasto-pruebas', username: correo, password: 'abasto123' } });
  return ((await r.json()) as { access_token: string }).access_token;
}

async function grafo<T>(request: APIRequestContext, token: string, query: string): Promise<{ data?: T; errors?: { message: string; extensions?: { code?: string } }[] }> {
  const r = await request.post(ROUTER, { headers: { authorization: `Bearer ${token}` }, data: { query } });
  return (await r.json()) as { data?: T };
}

/** Vuelve a dejar a Doña Rosa sin relación ni crédito con La Ramada: otras pruebas parten de ahí. */
function limpiar() {
  execSync(`docker compose exec -T mongo mongosh catalogo --quiet --eval "db.relaciones.deleteOne({ _id: 'dr|lr' })"`, { cwd: '..', stdio: 'inherit' });
  execSync('docker compose exec -T postgres psql -U abasto -d cobros -q -v ON_ERROR_STOP=1', {
    cwd: '..',
    input: "DELETE FROM lineas_de_credito WHERE tienda_id = 'dr' AND mayorista_id = 'lr';",
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

test.beforeAll(limpiar);
test.afterAll(limpiar);

test('CU-04: aprobar con crédito en el Panel le da el cupo a la tienda', async ({ page, request }) => {
  test.setTimeout(120_000);
  const tienda = await tokenDe(request, 'donarosa@abasto.bo');
  const LINEA = 'query { lineaDeCredito(tiendaId: "dr", mayoristaId: "lr") { limite { centavos } disponible { centavos } plazoDias } }';

  const solicitud = await grafo(request, tienda, 'mutation { pedirSerCliente(mayoristaId: "lr") { estado } }');
  expect(solicitud.errors).toBeUndefined();

  await page.goto('http://localhost:5170/clientes');
  await entrarComo(page, 'laramada@abasto.bo');

  // Aprueba con la lista Frecuentes y Bs 1.000 a 30 días
  const tarjeta = page.getByRole('article', { name: 'Tienda Doña Rosa' });
  await tarjeta.getByLabel('Con qué lista de precios').selectOption('FRECUENTES');
  await tarjeta.getByLabel('Crédito para Tienda Doña Rosa').fill('1.000');
  await tarjeta.getByLabel('Plazo para Tienda Doña Rosa').selectOption('30');
  await tarjeta.getByRole('button', { name: 'Aprobar' }).click();

  // Queda en «Te compran» con su crédito, y la tienda lo ve
  await expect(tarjeta).toContainText('Bs 1.000,00 disponibles');
  await expect(tarjeta).toContainText('a 30 días');
  const leida = await grafo<{ lineaDeCredito: { limite: { centavos: number }; plazoDias: number } }>(request, tienda, LINEA);
  expect(leida.data?.lineaDeCredito).toMatchObject({ limite: { centavos: 100_000 }, plazoDias: 30 });

  // Lo sube desde la tarjeta
  await tarjeta.getByRole('button', { name: 'Cambiar crédito' }).click();
  await tarjeta.getByLabel('Límite de crédito de Tienda Doña Rosa').fill('2.500,50');
  await tarjeta.getByRole('button', { name: '15 días' }).click();
  await tarjeta.getByRole('button', { name: 'Guardar crédito' }).click();
  await expect(tarjeta).toContainText('Bs 2.500,50 disponibles');
  await expect(tarjeta).toContainText('a 15 días');
  const cambiada = await grafo<{ lineaDeCredito: { limite: { centavos: number }; plazoDias: number } }>(request, tienda, LINEA);
  expect(cambiada.data?.lineaDeCredito).toMatchObject({ limite: { centavos: 250_050 }, plazoDias: 15 });

  // Otra empresa no puede ver ese crédito
  const ajena = await grafo(request, await tokenDe(request, 'lospozos@abasto.bo'), LINEA);
  expect(ajena.errors?.[0]?.extensions?.code).toBe('SIN_PERMISO');

  // Una tienda no puede darse crédito
  const propia = await grafo(request, tienda, 'mutation { asignarCredito(entrada: { tiendaId: "dr", limiteCentavos: 100, plazoDias: 15 }) { id } }');
  expect(propia.errors?.[0]?.extensions?.code).toBe('SIN_PERMISO');
});
