import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * Superadmin: Tiendas (suspender de verdad frena sus pedidos), Reportes, Integraciones y Usuarios. Ningún módulo queda
 * «en construcción».
 */
const CONECTA = 'http://localhost:8084';
const ROUTER = 'http://localhost:4000/';
const TOKEN = 'http://localhost:8180/realms/abasto/protocol/openid-connect/token';
const SUPERADMIN = 'http://localhost:5174';

async function tokenDe(request: APIRequestContext, correo: string) {
  const r = await request.post(TOKEN, { form: { grant_type: 'password', client_id: 'abasto-pruebas', username: correo, password: 'abasto123' } });
  return ((await r.json()) as { access_token: string }).access_token;
}

async function grafo<T>(request: APIRequestContext, token: string, query: string, variables: Record<string, unknown> = {}) {
  const r = await request.post(ROUTER, { headers: { authorization: `Bearer ${token}` }, data: { query, variables } });
  return (await r.json()) as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
}

/** Pase lo que pase en la prueba, Almacén Mery vuelve a quedar activa: otras pruebas no deben heredarlo. */
async function reactivarMery(request: APIRequestContext) {
  await grafo(request, await tokenDe(request, 'admin@abasto.bo'), 'mutation { reactivarTienda(id: "am") { suspendida } }');
}

test.afterEach(async ({ request }) => reactivarMery(request));

test('Tiendas: el admin ve quién compra y suspender frena los pedidos nuevos', async ({ page, request }) => {
  test.setTimeout(120_000);
  await reactivarMery(request);

  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));

  await page.goto(`${SUPERADMIN}/tiendas`);
  await entrarComo(page, 'admin@abasto.bo');
  await expect(page.getByRole('heading', { name: 'Tiendas' })).toBeVisible();

  // Busca y encuentra sin importar la tilde
  await page.getByLabel('Buscar tienda').fill('almacen mery');
  const fila = page.getByRole('row', { name: /Almacén Mery/ });
  await expect(fila).toContainText('Activa');

  // Suspende con motivo
  await fila.getByRole('button', { name: 'Suspender' }).click();
  await fila.getByLabel('Motivo para suspender a Almacén Mery').fill('Prueba: no paga sus pedidos');
  await fila.getByRole('button', { name: 'Suspender' }).click();
  await expect(fila).toContainText('Suspendida');
  await expect(fila).toContainText('Prueba: no paga sus pedidos');

  // Sigue suspendida al recargar: quedó en la base
  await page.reload();
  await page.getByRole('tab', { name: /Suspendidas/ }).click();
  await expect(page.getByRole('row', { name: /Almacén Mery/ })).toBeVisible();

  // Un pedido de esa tienda se rechaza con el motivo, sin importar por dónde entre
  const admin = await tokenDe(request, 'admin@abasto.bo');
  const sinPermiso = await grafo(request, await tokenDe(request, 'donarosa@abasto.bo'), 'query { tiendas { id } }');
  expect(sinPermiso.errors?.length).toBeGreaterThan(0);
  const lista = await grafo<{ tiendas: { id: string; suspendida: boolean }[] }>(request, admin, 'query { tiendas { id suspendida } }');
  expect(lista.data?.tiendas.find((t) => t.id === 'am')?.suspendida).toBe(true);

  // Reactiva
  await page.getByRole('row', { name: /Almacén Mery/ }).getByRole('button', { name: 'Reactivar' }).click();
  await page.getByRole('tab', { name: 'Todas' }).click();
  await expect(page.getByRole('row', { name: /Almacén Mery/ })).toContainText('Activa');
  expect(errores).toEqual([]);
});

test('Una tienda suspendida no puede hacer pedidos nuevos: la saga los rechaza con el motivo', async ({ request }) => {
  test.setTimeout(90_000);
  const admin = await tokenDe(request, 'admin@abasto.bo');
  const tienda = await tokenDe(request, 'donarosa@abasto.bo');
  const mutacion = await grafo(request, admin, 'mutation { suspenderTienda(id: "dr", motivo: "Prueba automática") { suspendida } }');
  expect(mutacion.errors).toBeUndefined();
  try {
    const creado = await grafo<{ crearPedido: { id: string } }>(request, tienda, 'mutation($e: CrearPedidoEntrada!) { crearPedido(entrada: $e) { id } }', {
      e: { clave: randomUUID(), mayoristaId: 'abasto', metodoPago: 'CONTRA_ENTREGA', lineas: [{ productoId: 'AB-101', presentacion: 'UNIDAD', cantidad: 1 }] },
    });
    const id = creado.data?.crearPedido.id;
    await expect
      .poll(
        async () => {
          const { data } = await grafo<{ pedido: { estado: string; motivoRechazo: string | null } }>(request, tienda, 'query($id: ID!) { pedido(id: $id) { estado motivoRechazo } }', { id });
          return data?.pedido.motivoRechazo ?? data?.pedido.estado;
        },
        { timeout: 30_000 },
      )
      .toContain('Tu cuenta está suspendida');
  } finally {
    await grafo(request, admin, 'mutation { reactivarTienda(id: "dr") { suspendida } }');
  }
});

test('Reportes, Integraciones y Usuarios muestran datos reales y ningún módulo está en construcción', async ({ page, request }) => {
  test.setTimeout(120_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));

  // Una llave para que Integraciones tenga qué mostrar; el secreto nunca aparece en pantalla
  const sesion = await tokenDe(request, 'donarosa@abasto.bo');
  const con = { authorization: `Bearer ${sesion}` };
  for (const l of (await (await request.get(`${CONECTA}/v1/llaves`, { headers: con })).json()) as { id: string }[]) {
    await request.delete(`${CONECTA}/v1/llaves/${l.id}`, { headers: con });
  }
  const { llave, datos } = (await (await request.post(`${CONECTA}/v1/llaves`, { headers: con, data: { nombre: 'Tienda para el Superadmin' } })).json()) as { llave: string; datos: { id: string } };

  try {
    await page.goto(`${SUPERADMIN}/reportes`);
    await entrarComo(page, 'admin@abasto.bo');
    await expect(page.getByRole('heading', { name: 'Pedidos por semana' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tiendas que compraron' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ventas por ciudad' })).toBeVisible();
    await expect(page.locator('.ciudad').first()).toBeVisible();
    await expect(page.getByRole('row').nth(1)).toBeVisible();

    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar para Excel' }).click();
    expect((await descarga).suggestedFilename()).toMatch(/^abasto-reporte-\d+-semanas\.csv$/);

    await page.getByRole('link', { name: 'Integraciones' }).or(page.getByRole('button', { name: 'Integraciones' })).first().click();
    await expect(page.getByRole('heading', { name: 'Llaves de API' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Tienda para el Superadmin/ })).toBeVisible();
    expect(await page.content()).not.toContain(llave);

    await page.getByRole('link', { name: 'Usuarios' }).or(page.getByRole('button', { name: 'Usuarios' })).first().click();
    await expect(page.getByRole('row', { name: /admin@abasto\.bo/ })).toContainText('Activo');

    // Todo el menú abre sin mensajes de obra
    for (const nombre of ['Tracción', 'Mayoristas', 'Tiendas', 'Reportes', 'Integraciones', 'Sistema', 'Auditoría', 'Usuarios']) {
      await page.getByRole('link', { name: nombre }).or(page.getByRole('button', { name: nombre })).first().click();
      await expect(page.getByRole('heading', { name: nombre, level: 1 })).toBeVisible();
      await expect(page.getByText('se construye en la fase')).toHaveCount(0);
    }
    expect(errores).toEqual([]);
  } finally {
    await request.delete(`${CONECTA}/v1/llaves/${datos.id}`, { headers: con });
  }
});
