import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { entrarComo } from './sesion';

const ROUTER = 'http://localhost:4000/';
const TOKEN = 'http://localhost:8180/realms/abasto/protocol/openid-connect/token';

async function tokenDe(request: APIRequestContext, correo: string) {
  const r = await request.post(TOKEN, {
    form: { grant_type: 'password', client_id: 'abasto-pruebas', username: correo, password: 'abasto123' },
  });
  expect(r.ok()).toBe(true);
  return ((await r.json()) as { access_token: string }).access_token;
}

/** Una consulta al Router con la sesión de una empresa. Falla si GraphQL devuelve errores. */
function grafo(request: APIRequestContext, token: string) {
  return async <T>(query: string, variables: Record<string, unknown> = {}): Promise<T> => {
    const r = await request.post(ROUTER, { headers: { authorization: `Bearer ${token}` }, data: { query, variables } });
    const cuerpo = (await r.json()) as { data?: T; errors?: { message: string }[] };
    if (cuerpo.errors?.length) throw new Error(cuerpo.errors.map((e) => e.message).join('; '));
    return cuerpo.data as T;
  };
}

interface Pedido {
  id: string;
  codigo: string;
  estado: string;
  motivoRechazo: string | null;
  total: { centavos: number };
  cobro: { estado: string; codigo: string; monto: { centavos: number } } | null;
}

const PEDIDO = `query($id: ID!) { pedido(id: $id) { id codigo estado motivoRechazo total { centavos } cobro { estado codigo monto { centavos } } } }`;
const CREAR = `mutation($e: CrearPedidoEntrada!) { crearPedido(entrada: $e) { id codigo estado } }`;
const CREDITO = `query { lineaDeCredito(tiendaId: "dr", mayoristaId: "lp") { disponible { centavos } } }`;

/** La saga es asíncrona: espera hasta que el pedido cumpla la condición. */
async function esperar(leer: () => Promise<Pedido>, condicion: (p: Pedido) => boolean, que: string) {
  let ultimo: Pedido | undefined;
  await expect
    .poll(async () => condicion((ultimo = await leer())), { message: `esperaba ${que}`, timeout: 20_000, intervals: [300, 500, 1000] })
    .toBe(true);
  return ultimo!;
}

test.describe('Saga de compra entre Pedidos (Java), Catálogo (PHP) y Cobros (NestJS) · cita 3', () => {
  test('por QR: reserva, la tienda paga, el mayorista confirma', async ({ request }) => {
    const tienda = grafo(request, await tokenDe(request, 'donarosa@abasto.bo'));
    const mayorista = grafo(request, await tokenDe(request, 'lospozos@abasto.bo'));

    const { crearPedido } = await tienda<{ crearPedido: Pedido }>(CREAR, {
      e: { clave: randomUUID(), mayoristaId: 'lp', metodoPago: 'QR', lineas: [{ productoId: 'HB-0090', presentacion: 'DOCENA', cantidad: 1 }] },
    });
    const leer = async () => (await tienda<{ pedido: Pedido }>(PEDIDO, { id: crearPedido.id })).pedido;

    // Catálogo reservó y fijó el precio de la lista FRECUENTES; Cobros generó el QR por ese total
    const conQr = await esperar(leer, (p) => p.cobro?.estado === 'PENDIENTE', 'el QR pendiente');
    expect(conQr.total.centavos).toBeGreaterThan(0);
    expect(conQr.cobro!.monto.centavos).toBe(conQr.total.centavos);
    expect(conQr.cobro!.codigo).toContain(crearPedido.id);

    await tienda(`mutation($id: ID!) { pagarQrDePrueba(pedidoId: $id) { estado } }`, { id: crearPedido.id });
    await esperar(leer, (p) => p.estado === 'POR_CONFIRMAR', 'que espere al mayorista');

    await mayorista(`mutation($id: ID!) { confirmarPedido(id: $id) { estado } }`, { id: crearPedido.id });
    const confirmado = await leer();
    expect(confirmado.estado).toBe('CONFIRMADO');
    expect(confirmado.cobro!.estado).toBe('PAGADO');
  });

  test('a crédito: si el mayorista rechaza, la saga devuelve el cupo y el QR no existe', async ({ request }) => {
    const tienda = grafo(request, await tokenDe(request, 'donarosa@abasto.bo'));
    const mayorista = grafo(request, await tokenDe(request, 'lospozos@abasto.bo'));
    const cupoAntes = (await tienda<{ lineaDeCredito: { disponible: { centavos: number } } }>(CREDITO)).lineaDeCredito.disponible.centavos;

    const { crearPedido } = await tienda<{ crearPedido: Pedido }>(CREAR, {
      e: { clave: randomUUID(), mayoristaId: 'lp', metodoPago: 'CREDITO', lineas: [{ productoId: 'LP-0004', presentacion: 'CUARTA', cantidad: 1 }] },
    });
    const leer = async () => (await tienda<{ pedido: Pedido }>(PEDIDO, { id: crearPedido.id })).pedido;

    const porConfirmar = await esperar(leer, (p) => p.estado === 'POR_CONFIRMAR', 'que espere al mayorista');
    expect(porConfirmar.cobro).toBeNull();
    const cupoReservado = (await tienda<{ lineaDeCredito: { disponible: { centavos: number } } }>(CREDITO)).lineaDeCredito.disponible.centavos;
    expect(cupoReservado).toBe(cupoAntes - porConfirmar.total.centavos);

    await mayorista(`mutation($id: ID!) { rechazarPedido(id: $id, motivo: "No llego a entregar hoy") { estado } }`, { id: crearPedido.id });
    const rechazado = await leer();
    expect(rechazado.estado).toBe('RECHAZADO');
    expect(rechazado.motivoRechazo).toBe('No llego a entregar hoy');

    // La compensación devuelve el cupo (Cobros) y el stock (Catálogo)
    await expect
      .poll(async () => (await tienda<{ lineaDeCredito: { disponible: { centavos: number } } }>(CREDITO)).lineaDeCredito.disponible.centavos, {
        timeout: 20_000,
      })
      .toBe(cupoAntes);
  });

  test('sin cupo de crédito, Cobros rechaza y el pedido se deshace con el motivo', async ({ request }) => {
    const tienda = grafo(request, await tokenDe(request, 'donarosa@abasto.bo'));
    // 1 caja de 72 pastas dentales × 10 = muy por encima de los Bs 4.000 de crédito
    const { crearPedido } = await tienda<{ crearPedido: Pedido }>(CREAR, {
      e: { clave: randomUUID(), mayoristaId: 'lp', metodoPago: 'CREDITO', lineas: [{ productoId: 'HB-0090', presentacion: 'CAJA', cantidad: 10 }] },
    });
    const leer = async () => (await tienda<{ pedido: Pedido }>(PEDIDO, { id: crearPedido.id })).pedido;

    const rechazado = await esperar(leer, (p) => p.estado === 'RECHAZADO', 'el rechazo');
    expect(rechazado.motivoRechazo).toMatch(/supera el crédito disponible/);
  });
});

test('Mercado: la tienda compra por QR desde la app y ve avanzar la saga', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await entrarComo(page, 'donarosa@abasto.bo');
  await page.getByText('Productos destacados').waitFor();
  await page.evaluate(() => localStorage.removeItem('abasto:carrito'));
  await page.reload();

  const nav = page.getByRole('navigation', { name: 'Secciones' });
  await nav.getByRole('button', { name: 'Buscar' }).click();
  await page.getByLabel('Buscar productos o mayoristas').fill('pasta dental');
  await page.getByRole('button', { name: /Agregar una docena de Pasta dental/ }).first().click();
  await nav.getByRole('button', { name: /Carrito/ }).click();
  await page.getByRole('button', { name: 'Continuar pedido' }).click();
  await page.getByRole('button', { name: 'Hacer el pedido' }).click();

  // La bandeja lo manda a Conecta; la saga reserva y Cobros genera el QR
  await page.getByRole('heading', { name: 'Mis pedidos' }).waitFor();
  await page.getByText('Paga con QR para que el mayorista lo reciba').first().click({ timeout: 20_000 });
  await page.getByRole('button', { name: /Pagar con QR · Bs/ }).click();
  await expect(page.getByAltText('Código QR del pedido')).toBeVisible();
  await page.getByRole('button', { name: 'Simular pago (demo)' }).click();

  await expect(page.getByText('Esperando al mayorista').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('El mayorista revisa tu pedido')).toBeVisible();
});
