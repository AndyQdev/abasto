import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';

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

    expect(productos.length).toBeGreaterThanOrEqual(36);
    const arroz = productos.find((p) => p.id === 'AB-001')!;
    expect(arroz.mayorista).toEqual({ deLaCasa: true, relacion: 'NINGUNA' });
    expect(arroz.precioVisible).toBe(true);
    expect(arroz.escalas.map((e) => e.precioUnitario?.centavos)).toEqual([820, 790]);
    expect(arroz.abastecimiento).toBe('BAJO_PEDIDO');
    expect(arroz.entregaHoras).toBe(24);
    expect(arroz.costoUnitario).toBeNull();
    expect(arroz.proveedor).toBeNull();
  });

  test('Abasto ve su costo y dónde compra cada producto', async ({ request }) => {
    const abasto = await grafoDe(request, 'ventas@abasto.bo');
    const { misProductos } = await abasto<{ misProductos: ProductoVisto[] }>(`query { misProductos { ${CAMPOS} } }`);

    const arroz = misProductos.find((p) => p.id === 'AB-001')!;
    expect(arroz.costoUnitario?.texto).toBe('Bs 7,35');
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

    // 2 fardos de 24 a Bs 7,90 = Bs 379,20, aunque el stock de Abasto sea 0
    await expect.poll(async () => (await leer()).cobro?.estado, { timeout: 20_000 }).toBe('PENDIENTE');
    expect((await leer()).total.centavos).toBe(2 * 24 * 790);

    await tienda(`mutation($id: ID!) { pagarQrDePrueba(pedidoId: $id) { estado } }`, { id: crearPedido.id });
    await expect.poll(async () => (await leer()).estado, { timeout: 20_000 }).toBe('POR_CONFIRMAR');

    await abasto(`mutation($id: ID!) { confirmarPedido(id: $id) { estado } }`, { id: crearPedido.id });
    expect((await leer()).estado).toBe('CONFIRMADO');

    // Bajo pedido no descuenta stock: sigue en 0 y a la venta
    const { producto } = await abasto<{ producto: ProductoVisto }>(`query { producto(id: "AB-001") { ${CAMPOS} } }`);
    expect(producto.stock).toBe(0);
  });
});
