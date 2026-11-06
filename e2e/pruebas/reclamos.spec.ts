import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * CU-16: la tienda reporta un problema, Abasto lo resuelve a mano en el Superadmin y el sistema solo anota la devolución.
 * Lo que se debe del pedido no cambia: la devolución no mueve Cobros.
 */
const ROUTER = 'http://localhost:4000/';
const TOKEN = 'http://localhost:8180/realms/abasto/protocol/openid-connect/token';

async function tokenDe(request: APIRequestContext, correo: string) {
  const r = await request.post(TOKEN, { form: { grant_type: 'password', client_id: 'abasto-pruebas', username: correo, password: 'abasto123' } });
  return ((await r.json()) as { access_token: string }).access_token;
}

async function grafo<T>(request: APIRequestContext, token: string, query: string, variables: Record<string, unknown> = {}) {
  const r = await request.post(ROUTER, { headers: { authorization: `Bearer ${token}` }, data: { query, variables } });
  return (await r.json()) as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
}

const CAMPOS = 'id motivo detalle estado respuesta devuelto { centavos texto } forma';
const ABRIR = `mutation($e: AbrirReclamoEntrada!) { abrirReclamo(entrada: $e) { ${CAMPOS} } }`;
const PEDIDO = `query($id: ID!) { pedido(id: $id) { estado total { centavos texto } reclamo { ${CAMPOS} } } }`;

interface Reclamo {
  id: string;
  estado: string;
  respuesta: string | null;
  devuelto: { centavos: number; texto: string } | null;
  forma: string | null;
}

/** Un pedido recién hecho a Abasto y ya confirmado: tiene total y abre su cuenta por cobrar. */
async function pedidoConfirmado(request: APIRequestContext, tienda: string, mayorista: string) {
  const creado = await grafo<{ crearPedido: { id: string; codigo: string } }>(request, tienda, 'mutation($e: CrearPedidoEntrada!) { crearPedido(entrada: $e) { id codigo } }', {
    e: { clave: randomUUID(), mayoristaId: 'abasto', metodoPago: 'CONTRA_ENTREGA', lineas: [{ productoId: 'AB-101', presentacion: 'UNIDAD', cantidad: 1 }] },
  });
  const { id, codigo } = creado.data?.crearPedido ?? { id: '', codigo: '' };
  await expect
    .poll(
      async () => {
        const r = await grafo<{ confirmarPedido: { estado: string } }>(request, mayorista, 'mutation($id: ID!) { confirmarPedido(id: $id) { estado } }', { id });
        return r.data?.confirmarPedido?.estado;
      },
      { timeout: 30_000, intervals: [1000, 2000] },
    )
    .toBe('CONFIRMADO');
  return { id, codigo };
}

test('CU-16: la tienda reporta, Abasto lo anota en el Superadmin y la tienda lee la respuesta', async ({ page, request }) => {
  test.setTimeout(150_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));

  const tienda = await tokenDe(request, 'donarosa@abasto.bo');
  const mayorista = await tokenDe(request, 'ventas@abasto.bo');
  const { id, codigo } = await pedidoConfirmado(request, tienda, mayorista);

  // Otra empresa no puede reclamar ni saber que el pedido existe
  const ajena = await grafo(request, await tokenDe(request, 'lospozos@abasto.bo'), ABRIR, { e: { pedidoId: id, motivo: 'DANADO' } });
  expect(ajena.errors?.[0]?.extensions?.code).toBe('PEDIDO_NO_EXISTE');

  // «Otro» pide contar qué pasó
  const sinDetalle = await grafo(request, tienda, ABRIR, { e: { pedidoId: id, motivo: 'OTRO' } });
  expect(sinDetalle.errors?.[0]?.extensions?.code).toBe('DETALLE_REQUERIDO');

  // La tienda reporta. Repetirlo (doble toque) devuelve el mismo
  const abierto = await grafo<{ abrirReclamo: Reclamo }>(request, tienda, ABRIR, { e: { pedidoId: id, motivo: 'INCOMPLETO', detalle: 'Faltó una bolsa' } });
  expect(abierto.errors).toBeUndefined();
  const repetido = await grafo<{ abrirReclamo: Reclamo }>(request, tienda, ABRIR, { e: { pedidoId: id, motivo: 'DANADO' } });
  expect(repetido.data?.abrirReclamo.id).toBe(abierto.data?.abrirReclamo.id);
  expect((await grafo<{ pedido: { reclamo: Reclamo } }>(request, tienda, PEDIDO, { id })).data?.pedido.reclamo.estado).toBe('ABIERTO');

  // El mayorista lo ve en su Panel y lo sabe antes de que le escriban
  const enVentas = await grafo<{ misVentas: { codigo: string; reclamo: { estado: string } | null }[] }>(request, mayorista, 'query { misVentas { codigo reclamo { estado } } }');
  expect(enVentas.data?.misVentas.find((v) => v.codigo === codigo)?.reclamo?.estado).toBe('ABIERTO');

  // Una tienda no puede ver todos los reclamos ni resolver el suyo
  expect((await grafo(request, tienda, 'query { reclamos { id } }')).errors?.[0]?.extensions?.code).toBe('SOLO_ADMIN');
  const resolverSolo = await grafo(request, tienda, 'mutation($e: ResolverReclamoEntrada!) { resolverReclamo(entrada: $e) { id } }', {
    e: { reclamoId: abierto.data?.abrirReclamo.id, aprobado: true, devueltoCentavos: 1, forma: 'QR', respuesta: 'Me devuelvo todo' },
  });
  expect(resolverSolo.errors?.[0]?.extensions?.code).toBe('SOLO_ADMIN');

  // Lo que se debe antes de resolver
  const deudaDe = async () => {
    const r = await grafo<{ cuentasPorCobrar: { cuentas: { codigo: string; saldo: { centavos: number } }[] } }>(request, mayorista, 'query { cuentasPorCobrar { cuentas { codigo saldo { centavos } } } }');
    return r.data?.cuentasPorCobrar.cuentas.find((c) => c.codigo === codigo)?.saldo.centavos;
  };
  await expect.poll(deudaDe, { timeout: 20_000 }).toBeGreaterThan(0);
  const deudaAntes = await deudaDe();

  // Abasto lo resuelve en el Superadmin
  await page.goto('http://localhost:5174/reclamos');
  await entrarComo(page, 'admin@abasto.bo');
  const tarjeta = page.getByRole('article', { name: `Reclamo del pedido ${codigo}` });
  await expect(tarjeta).toContainText('Llegó incompleto');
  await expect(tarjeta).toContainText('Faltó una bolsa');

  // No deja anotar más que el total ni dinero sin decir cómo
  await tarjeta.getByLabel('Tu respuesta').fill('Disculpa, te devolvimos la bolsa que faltó');
  await tarjeta.getByLabel(`Monto devuelto de ${codigo}`).fill('999.999,00');
  await expect(tarjeta.getByRole('button', { name: 'Aprobar y anotar' })).toBeDisabled();
  await tarjeta.getByRole('button', { name: 'Todo' }).click();
  await expect(tarjeta.getByRole('button', { name: 'Aprobar y anotar' })).toBeDisabled();
  await tarjeta.getByLabel(`Forma de devolución de ${codigo}`).selectOption('TRANSFERENCIA');
  await tarjeta.getByRole('button', { name: 'Aprobar y anotar' }).click();
  await expect(tarjeta).toHaveCount(0);

  // Queda entre los aprobados, también al recargar
  await page.reload();
  await page.getByRole('tab', { name: 'Aprobados' }).click();
  const aprobada = page.getByRole('article', { name: `Reclamo del pedido ${codigo}` });
  await expect(aprobada).toContainText('Devolviste');
  await expect(aprobada).toContainText('por transferencia');
  expect(errores).toEqual([]);

  // La tienda lee la respuesta y lo devuelto
  const final = await grafo<{ pedido: { total: { centavos: number }; reclamo: Reclamo } }>(request, tienda, PEDIDO, { id });
  expect(final.data?.pedido.reclamo).toMatchObject({ estado: 'APROBADO', respuesta: 'Disculpa, te devolvimos la bolsa que faltó', forma: 'TRANSFERENCIA' });
  expect(final.data?.pedido.reclamo.devuelto?.centavos).toBe(final.data?.pedido.total.centavos);

  // Solo se anotó: lo que se debe del pedido no cambió
  expect(await deudaDe()).toBe(deudaAntes);

  // Ya resuelto, no cambia
  const otraVez = await grafo(request, await tokenDe(request, 'admin@abasto.bo'), 'mutation($e: ResolverReclamoEntrada!) { resolverReclamo(entrada: $e) { id } }', {
    e: { reclamoId: abierto.data?.abrirReclamo.id, aprobado: false, respuesta: 'Cambié de idea' },
  });
  expect(otraVez.errors?.[0]?.extensions?.code).toBe('RECLAMO_YA_RESUELTO');
});

test('CU-16: rechazar pide la respuesta y la tienda la lee', async ({ request }) => {
  test.setTimeout(90_000);
  const tienda = await tokenDe(request, 'donarosa@abasto.bo');
  const admin = await tokenDe(request, 'admin@abasto.bo');
  const { id } = await pedidoConfirmado(request, tienda, await tokenDe(request, 'ventas@abasto.bo'));
  const abierto = await grafo<{ abrirReclamo: Reclamo }>(request, tienda, ABRIR, { e: { pedidoId: id, motivo: 'NO_LLEGO' } });
  const reclamoId = abierto.data?.abrirReclamo.id;
  const RESOLVER = 'mutation($e: ResolverReclamoEntrada!) { resolverReclamo(entrada: $e) { estado } }';

  expect((await grafo(request, admin, RESOLVER, { e: { reclamoId, aprobado: false, respuesta: '  ' } })).errors?.[0]?.extensions?.code).toBe('RESPUESTA_REQUERIDA');
  expect((await grafo(request, admin, RESOLVER, { e: { reclamoId, aprobado: true, devueltoCentavos: 999_999_999, forma: 'QR', respuesta: 'Sí' } })).errors?.[0]?.extensions?.code).toBe('DEVUELTO_MAYOR_QUE_EL_TOTAL');
  expect((await grafo(request, admin, RESOLVER, { e: { reclamoId, aprobado: true, devueltoCentavos: 100, respuesta: 'Sí' } })).errors?.[0]?.extensions?.code).toBe('FORMA_REQUERIDA');

  expect((await grafo(request, admin, RESOLVER, { e: { reclamoId, aprobado: false, respuesta: 'El pedido todavía está en camino' } })).errors).toBeUndefined();
  const final = await grafo<{ pedido: { reclamo: Reclamo } }>(request, tienda, PEDIDO, { id });
  expect(final.data?.pedido.reclamo).toMatchObject({ estado: 'RECHAZADO', respuesta: 'El pedido todavía está en camino', devuelto: null });
});
