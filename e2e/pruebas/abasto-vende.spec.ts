import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * Modelo de lanzamiento (28/10/2026): Abasto vende por su cuenta como vendedor de la casa.
 * Todo es bajo pedido: cuando entra el pedido, Andrés lo compra en el mercado.
 * La semilla de Abasto la carga e2e/preparar.ts.
 */
const ROUTER = 'http://localhost:4000/';
const TOKEN = 'http://localhost:8180/realms/abasto/protocol/openid-connect/token';

async function grafoDe(request: APIRequestContext, correo: string) {
  const r = await request.post(TOKEN, { form: { grant_type: 'password', client_id: 'abasto-pruebas', username: correo, password: 'abasto123' } });
  const token = ((await r.json()) as { access_token: string }).access_token;
  return async <T>(query: string, variables: Record<string, unknown> = {}): Promise<T> => {
    const respuesta = await request.post(ROUTER, { headers: { authorization: `Bearer ${token}` }, data: { query, variables } });
    const cuerpo = (await respuesta.json()) as { data?: T; errors?: { message: string }[] };
    if (cuerpo.errors?.length) throw new Error(cuerpo.errors.map((e) => e.message).join('; '));
    return cuerpo.data as T;
  };
}

interface ProductoVisto {
  id: string;
  stock: number;
  abastecimiento: string;
  entregaHoras: number | null;
  precioVisible: boolean;
  costoUnitario: { texto: string } | null;
  proveedor: string | null;
  mayorista: { deLaCasa: boolean; relacion: string };
  escalas: { presentacion: string; precioUnitario: { centavos: number } | null }[];
}

const CAMPOS = `id stock abastecimiento entregaHoras precioVisible costoUnitario { texto } proveedor
  mayorista { deLaCasa relacion } escalas { presentacion precioUnitario { centavos } }`;

test.describe('Abasto vende (vendedor de la casa)', () => {
  test('una tienda nueva ve los precios de Abasto sin pedir ser cliente, pero no su costo', async ({ request }) => {
    // Doña Rosa nunca pidió ser cliente de Abasto
    const tienda = await grafoDe(request, 'donarosa@abasto.bo');
    const { productos } = await tienda<{ productos: ProductoVisto[] }>(`query { productos(mayoristaId: "abasto") { ${CAMPOS} } }`);

    expect(productos.length).toBeGreaterThanOrEqual(27);
    const arroz = productos.find((p) => p.id === 'AB-001')!;
    expect(arroz.mayorista).toEqual({ deLaCasa: true, relacion: 'NINGUNA' });
    expect(arroz.precioVisible).toBe(true);
    expect(arroz.escalas.map((e) => e.precioUnitario?.centavos)).toEqual([1540, 1400]);
    expect(arroz.abastecimiento).toBe('BAJO_PEDIDO');
    expect(arroz.entregaHoras).toBe(24);
    expect(arroz.costoUnitario).toBeNull();
    expect(arroz.proveedor).toBeNull();
  });

  test('Abasto ve su costo y dónde compra cada producto', async ({ request }) => {
    const abasto = await grafoDe(request, 'ventas@abasto.bo');
    const { misProductos } = await abasto<{ misProductos: ProductoVisto[] }>(`query { misProductos { ${CAMPOS} } }`);

    const arroz = misProductos.find((p) => p.id === 'AB-001')!;
    expect(arroz.costoUnitario?.texto).toBe('Bs 13,00');
    expect(arroz.proveedor).toBe('Mercado Los Pozos');
  });

  test('comprarle a Abasto: se reserva sin stock, la tienda paga y Abasto confirma', async ({ request }) => {
    const tienda = await grafoDe(request, 'donarosa@abasto.bo');
    const abasto = await grafoDe(request, 'ventas@abasto.bo');

    const { crearPedido } = await tienda<{ crearPedido: { id: string } }>(
      `mutation($e: CrearPedidoEntrada!) { crearPedido(entrada: $e) { id } }`,
      { e: { clave: randomUUID(), mayoristaId: 'abasto', metodoPago: 'QR', lineas: [{ productoId: 'AB-001', presentacion: 'FARDO', cantidad: 2 }] } },
    );
    const leer = async () =>
      (
        await tienda<{ pedido: { estado: string; total: { centavos: number }; cobro: { estado: string } | null } }>(
          `query($id: ID!) { pedido(id: $id) { estado total { centavos } cobro { estado } } }`,
          { id: crearPedido.id },
        )
      ).pedido;

    // 2 fardos de 24 a Bs 14,00 = Bs 672,00, aunque el stock de Abasto sea 0
    await expect.poll(async () => (await leer()).cobro?.estado, { timeout: 20_000 }).toBe('PENDIENTE');
    expect((await leer()).total.centavos).toBe(2 * 24 * 1400);

    await tienda(`mutation($id: ID!) { pagarQrDePrueba(pedidoId: $id) { estado } }`, { id: crearPedido.id });
    await expect.poll(async () => (await leer()).estado, { timeout: 20_000 }).toBe('POR_CONFIRMAR');

    await abasto(`mutation($id: ID!) { confirmarPedido(id: $id) { estado } }`, { id: crearPedido.id });
    expect((await leer()).estado).toBe('CONFIRMADO');

    // Bajo pedido no descuenta stock: sigue en 0 y a la venta
    const { producto } = await abasto<{ producto: ProductoVisto }>(`query { producto(id: "AB-001") { ${CAMPOS} } }`);
    expect(producto.stock).toBe(0);
  });
  test('contra entrega: lista de compras con proveedor y costo, y la entrega de a un paso', async ({ request }) => {
    const tienda = await grafoDe(request, 'donarosa@abasto.bo');
    const abasto = await grafoDe(request, 'ventas@abasto.bo');

    const { crearPedido } = await tienda<{ crearPedido: { id: string; codigo: string } }>(
      `mutation($e: CrearPedidoEntrada!) { crearPedido(entrada: $e) { id codigo } }`,
      {
        e: {
          clave: randomUUID(),
          mayoristaId: 'abasto',
          metodoPago: 'CONTRA_ENTREGA',
          lineas: [{ productoId: 'AB-007', presentacion: 'DOCENA', cantidad: 3 }],
        },
      },
    );
    const leer = async () =>
      (
        await tienda<{ pedido: { estado: string; cobro: unknown } }>(`query($id: ID!) { pedido(id: $id) { estado cobro { estado } } }`, {
          id: crearPedido.id,
        })
      ).pedido;

    // Sin cobro previo: pasa directo a esperar a Abasto
    await expect.poll(async () => (await leer()).estado, { timeout: 20_000 }).toBe('POR_CONFIRMAR');
    expect((await leer()).cobro).toBeNull();
    await abasto(`mutation($id: ID!) { confirmarPedido(id: $id) { estado } }`, { id: crearPedido.id });

    // La lista junta Pedidos (unidades y venta) con Catálogo (nombre, proveedor y costo) en una consulta
    type Linea = { unidades: number; venta: { centavos: number }; pedidos: string[]; producto: { id: string; nombre: string; proveedor: string; costoUnitario: { centavos: number } } };
    const lista = async () =>
      (
        await abasto<{ listaDeCompras: Linea[] }>(
          `{ listaDeCompras { unidades venta { centavos } pedidos producto { id nombre proveedor costoUnitario { centavos } } } }`,
        )
      ).listaDeCompras.find((l) => l.pedidos.includes(crearPedido.codigo));
    const sal = await lista();
    expect(sal?.producto).toMatchObject({ id: 'AB-007', nombre: 'Sal fina Lobos 1 kg', proveedor: 'Mercado Mutualista', costoUnitario: { centavos: 550 } });
    expect(sal!.unidades).toBeGreaterThanOrEqual(36);

    const avanzar = () => abasto<{ avanzarEntrega: { estado: string } }>(`mutation($id: ID!) { avanzarEntrega(id: $id) { estado } }`, { id: crearPedido.id });
    expect((await avanzar()).avanzarEntrega.estado).toBe('EN_PREPARACION');
    expect((await avanzar()).avanzarEntrega.estado).toBe('DESPACHADO');
    // Ya salió: no figura más en lo que hay que comprar
    expect(await lista()).toBeUndefined();
    expect((await avanzar()).avanzarEntrega.estado).toBe('ENTREGADO');
    await expect(avanzar()).rejects.toThrow(/solo se avanza un pedido confirmado/);
  });
});

test('Panel de Abasto: la lista de compras por puesto y preparar un pedido confirmado', async ({ page, request }) => {
  const tienda = await grafoDe(request, 'donarosa@abasto.bo');
  const abasto = await grafoDe(request, 'ventas@abasto.bo');
  const { crearPedido } = await tienda<{ crearPedido: { id: string; codigo: string } }>(
    `mutation($e: CrearPedidoEntrada!) { crearPedido(entrada: $e) { id codigo } }`,
    { e: { clave: randomUUID(), mayoristaId: 'abasto', metodoPago: 'CONTRA_ENTREGA', lineas: [{ productoId: 'AB-007', presentacion: 'DOCENA', cantidad: 1 }] } },
  );
  await expect
    .poll(async () => (await abasto<{ pedido: { estado: string } }>(`query($id: ID!) { pedido(id: $id) { estado } }`, { id: crearPedido.id })).pedido.estado, { timeout: 20_000 })
    .toBe('POR_CONFIRMAR');
  await abasto(`mutation($id: ID!) { confirmarPedido(id: $id) { estado } }`, { id: crearPedido.id });

  await page.goto('http://localhost:5170/compras');
  await entrarComo(page, 'ventas@abasto.bo');
  await expect(page.getByText('vas a gastar')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Mercado Mutualista/ })).toBeVisible();
  await expect(page.getByText('Sal fina Lobos 1 kg')).toBeVisible();

  await page.getByRole('link', { name: 'Pedidos' }).click();
  const fila = page.getByRole('row').filter({ hasText: crearPedido.codigo });
  await fila.getByRole('button', { name: 'Preparar' }).click();
  await expect(fila.getByText('En preparación')).toBeVisible();
});

test('Panel de Abasto: filtra los productos por área y decide a quién se muestra cada uno (usos)', async ({ page, request }) => {
  const abasto = await grafoDe(request, 'ventas@abasto.bo');
  const usosDe = async (id: string) => (await abasto<{ producto: { usos: string[] } }>(`query($id: ID!) { producto(id: $id) { usos } }`, { id })).producto.usos;
  // El yogurt es de la tienda y el hogar; el panadero no lo ve
  await abasto(`mutation { editarProducto(id: "AB-018", entrada: { usos: ["hogar", "tienda"] }) { id } }`);

  await page.goto('http://localhost:5170/productos');
  await entrarComo(page, 'ventas@abasto.bo');
  const areas = page.getByRole('group', { name: 'Filtrar por área' });
  await areas.getByRole('button', { name: /^Panadería/ }).click();
  await expect(page.getByText('Levadura seca instantánea 500 g')).toBeVisible();
  await expect(page.getByText('Yogurt bebible PIL durazno 1 L')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/panel-usos.png', fullPage: false });

  // Un toque en «Panadería» del yogurt lo prende: queda en Catálogo
  await areas.getByRole('button', { name: /^Tienda/ }).click();
  const yogurt = page.getByRole('row').filter({ hasText: 'Yogurt bebible PIL durazno 1 L' });
  await yogurt.getByRole('button', { name: 'Panadería' }).click();
  await expect.poll(() => usosDe('AB-018')).toEqual(['hogar', 'tienda', 'panaderia']);
  await yogurt.getByRole('button', { name: 'Panadería' }).click();
  await expect.poll(() => usosDe('AB-018')).toEqual(['hogar', 'tienda']);
});
