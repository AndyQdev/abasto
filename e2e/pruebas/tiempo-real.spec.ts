import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Tiempo real en vez de sondeo (02/11): la app abre un WebSocket con Conecta (/v1/tiempo-real), se presenta con su
 * token y recibe un aviso cada vez que cambia un pedido suyo. Otra organización nunca recibe los avisos de esta tienda.
 */
const ROUTER = 'http://localhost:4000/';
const TOKEN = 'http://localhost:8180/realms/abasto/protocol/openid-connect/token';
const CANAL = 'ws://localhost:8084/v1/tiempo-real';

async function tokenDe(request: APIRequestContext, correo: string) {
  const r = await request.post(TOKEN, { form: { grant_type: 'password', client_id: 'abasto-pruebas', username: correo, password: 'abasto123' } });
  return ((await r.json()) as { access_token: string }).access_token;
}

function grafo(request: APIRequestContext, token: string) {
  return async <T>(query: string, variables: Record<string, unknown> = {}): Promise<T> => {
    const respuesta = await request.post(ROUTER, { headers: { authorization: `Bearer ${token}` }, data: { query, variables } });
    const cuerpo = (await respuesta.json()) as { data?: T; errors?: { message: string }[] };
    if (cuerpo.errors?.length) throw new Error(cuerpo.errors.map((e) => e.message).join('; '));
    return cuerpo.data as T;
  };
}

type Aviso = { tipo: string; pedidoId?: string; codigo?: string | null };

/** Abre el canal como lo hace la app y junta todo lo que llega */
async function abrirCanal(token: string) {
  const avisos: Aviso[] = [];
  const cierres: number[] = [];
  const socket = new WebSocket(CANAL);
  await new Promise<void>((listo, falla) => {
    socket.onopen = () => socket.send(JSON.stringify({ tipo: 'hola', token }));
    socket.onerror = () => falla(new Error('No se pudo abrir el canal'));
    socket.onmessage = (m) => {
      const aviso = JSON.parse(String(m.data)) as Aviso;
      if (aviso.tipo === 'listo') listo();
      else avisos.push(aviso);
    };
  });
  socket.onclose = (e) => cierres.push(e.code);
  return { socket, avisos, cierres, cerrar: () => socket.close() };
}

const tiposDe = (avisos: Aviso[], pedidoId: string) => avisos.filter((a) => a.pedidoId === pedidoId).map((a) => a.tipo);

test('la tienda recibe cada paso de su pedido en tiempo real; otra organización no recibe nada', async ({ request }) => {
  const tokenTienda = await tokenDe(request, 'donarosa@abasto.bo');
  const tienda = grafo(request, tokenTienda);
  const abasto = grafo(request, await tokenDe(request, 'ventas@abasto.bo'));
  const canalTienda = await abrirCanal(tokenTienda);
  const canalOtro = await abrirCanal(await tokenDe(request, 'lospozos@abasto.bo'));

  const { crearPedido } = await tienda<{ crearPedido: { id: string; codigo: string } }>(
    `mutation($e: CrearPedidoEntrada!) { crearPedido(entrada: $e) { id codigo } }`,
    { e: { clave: randomUUID(), mayoristaId: 'abasto', metodoPago: 'CONTRA_ENTREGA', lineas: [{ productoId: 'AB-007', presentacion: 'DOCENA', cantidad: 1 }] } },
  );
  const id = crearPedido.id;
  await expect.poll(() => tiposDe(canalTienda.avisos, id), { timeout: 20_000 }).toContain('pedido.por_confirmar');

  await abasto(`mutation($id: ID!) { confirmarPedido(id: $id) { estado } }`, { id });
  for (let i = 0; i < 3; i++) await abasto(`mutation($id: ID!) { avanzarEntrega(id: $id) { estado } }`, { id });

  await expect
    .poll(() => tiposDe(canalTienda.avisos, id), { timeout: 20_000 })
    .toEqual(['pedido.creado', 'pedido.por_confirmar', 'pedido.confirmado', 'pedido.en_preparacion', 'pedido.despachado', 'pedido.entregado']);
  expect(canalTienda.avisos.find((a) => a.pedidoId === id)?.codigo).toBe(crearPedido.codigo);
  expect(tiposDe(canalOtro.avisos, id)).toEqual([]);

  canalTienda.cerrar();
  canalOtro.cerrar();
});

test('por QR: avisa cuando el QR está listo y cuando se paga, sin que la app pregunte', async ({ request }) => {
  const tokenTienda = await tokenDe(request, 'donarosa@abasto.bo');
  const tienda = grafo(request, tokenTienda);
  const canal = await abrirCanal(tokenTienda);
  const { crearPedido } = await tienda<{ crearPedido: { id: string } }>(
    `mutation($e: CrearPedidoEntrada!) { crearPedido(entrada: $e) { id } }`,
    { e: { clave: randomUUID(), mayoristaId: 'abasto', metodoPago: 'QR', lineas: [{ productoId: 'AB-001', presentacion: 'FARDO', cantidad: 1 }] } },
  );
  const id = crearPedido.id;
  await expect.poll(() => tiposDe(canal.avisos, id), { timeout: 20_000 }).toContain('cobro.qr_generado');
  // Con el aviso, el QR ya se puede leer
  const { pedido } = await tienda<{ pedido: { cobro: { estado: string } | null } }>(`query($id: ID!) { pedido(id: $id) { cobro { estado } } }`, { id });
  expect(pedido.cobro?.estado).toBe('PENDIENTE');

  await tienda(`mutation($id: ID!) { pagarQrDePrueba(pedidoId: $id) { estado } }`, { id });
  await expect.poll(() => tiposDe(canal.avisos, id), { timeout: 20_000 }).toEqual(expect.arrayContaining(['cobro.qr_pagado', 'pedido.por_confirmar']));
  canal.cerrar();
});

test('sin sesión o con un token falso, el canal se cierra con 4401', async () => {
  const cierre = (mensaje: string) =>
    new Promise<number>((listo) => {
      const s = new WebSocket(CANAL);
      s.onopen = () => s.send(mensaje);
      s.onclose = (e) => listo(e.code);
    });
  expect(await cierre(JSON.stringify({ tipo: 'hola' }))).toBe(4401);
  expect(await cierre(JSON.stringify({ tipo: 'hola', token: 'no.es.un.token' }))).toBe(4401);
});
