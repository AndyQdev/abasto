import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { AlmacenEnMemoria, existencias, MIS_COMPRAS, sincronizarCompras, type Pedido } from '../../packages/comercio/src/index';
import { entrarComo } from './sesion';

/**
 * «Mi negocio», Fase 2 (docs/plan-mi-negocio.md): lo que la tienda compra en Abasto entra solo a su inventario cuando
 * el pedido llega a ENTREGADO. Aquí va de punta a punta contra el sistema real: la tienda pide, Abasto lo confirma,
 * prepara, despacha y entrega desde el Panel, y el motor de la app (el mismo código de packages/comercio) lo registra
 * una sola vez aunque se sincronice dos veces.
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

test('lo que se entrega desde el Panel entra solo al inventario de la tienda, una sola vez', async ({ page, request }) => {
  test.setTimeout(120_000);
  const tienda = await grafoDe(request, 'donarosa@abasto.bo');
  const { crearPedido } = await tienda<{ crearPedido: { id: string; codigo: string } }>(
    `mutation($e: CrearPedidoEntrada!) { crearPedido(entrada: $e) { id codigo } }`,
    {
      e: {
        clave: randomUUID(),
        mayoristaId: 'abasto',
        metodoPago: 'CONTRA_ENTREGA',
        lineas: [
          { productoId: 'AB-101', presentacion: 'UNIDAD', cantidad: 2 },
          { productoId: 'AB-007', presentacion: 'DOCENA', cantidad: 1 },
        ],
      },
    },
  );
  const estadoParaLaTienda = async () => {
    const { misCompras } = await tienda<{ misCompras: Pedido[] }>(MIS_COMPRAS);
    return misCompras.find((p) => p.id === crearPedido.id);
  };
  await expect.poll(async () => (await estadoParaLaTienda())?.estado, { timeout: 20_000 }).toBe('POR_CONFIRMAR');

  // Mientras no llega, no entra nada
  const almacen = new AlmacenEnMemoria();
  expect(await sincronizarCompras(almacen, [(await estadoParaLaTienda())!], new Date().toISOString())).toBe(0);

  // Abasto lo avanza desde el Panel, botón por botón
  await page.goto('http://localhost:5170/pedidos');
  await entrarComo(page, 'ventas@abasto.bo');
  // Tablero v7: cada tarjeta tiene un solo botón, el paso que sigue; al tocarlo, la tarjeta avanza
  const tarjeta = page.getByRole('article', { name: `Pedido ${crearPedido.codigo}` });
  for (const [boton, siguiente] of [
    ['Confirmar', 'Preparar'],
    ['Preparar', 'Despachar'],
    ['Despachar', 'Marcar entregado'],
    ['Marcar entregado', null],
  ] as const) {
    await tarjeta.getByRole('button', { name: boton, exact: true }).click();
    if (siguiente) await expect(tarjeta.getByRole('button', { name: siguiente, exact: true })).toBeVisible({ timeout: 15_000 });
    else await expect(tarjeta).toHaveCount(0, { timeout: 15_000 }); // entregado: sale del tablero (queda en «Entregados»)
  }

  // La tienda lo ve entregado, con lo que el inventario necesita: unidades y lo que pagó por línea
  await expect.poll(async () => (await estadoParaLaTienda())?.estado, { timeout: 20_000 }).toBe('ENTREGADO');
  const entregado = (await estadoParaLaTienda())!;
  expect(entregado.lineas.map((l) => [l.producto.id, l.unidades])).toEqual(
    expect.arrayContaining([
      ['AB-101', 2],
      ['AB-007', 12],
    ]),
  );
  for (const l of entregado.lineas) expect(l.subtotal.centavos).toBeGreaterThan(0);

  // Entra una vez, aunque la app lea misCompras en cada pantalla
  const ahora = new Date().toISOString();
  expect(await sincronizarCompras(almacen, [entregado], ahora)).toBe(2);
  expect(await sincronizarCompras(almacen, [entregado], ahora)).toBe(0);
  const hay = existencias(await almacen.leer());
  expect(hay.find((x) => x.articulo.productoId === 'AB-101')!.texto).toBe('2 quintales · 92 kg');
  expect(hay.find((x) => x.articulo.productoId === 'AB-007')!.texto).toBe('12 u. · 12 kg');
});
