import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * «Mi negocio» en la base de datos (fase 3 de docs/plan-mi-negocio.md): todo queda en el esquema negocio de Cobros.
 * - Lo que sube un celular lo baja otro celular del mismo cliente, y nunca otro cliente.
 * - Lo que Abasto entrega entra solo, sin que la app haga nada (Cobros escucha pedido.entregado).
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

const MI_NEGOCIO = `query($desde: String) { miNegocio(desde: $desde) {
  hasta
  articulos { id nombre detalle rubro medida { envase porEnvase unidad } clase origen productoId precioVentaCentavos actualizadoEn eliminado }
  movimientos { id articuloId tipo cantidad costoUnitarioCentavos origen claveUnica nota }
  ventas { id forma clienteId totalCentavos lineas { articuloId cantidad precioUnitarioCentavos } }
  clientes { id nombre } fiados { id clienteId tipo montoCentavos }
  recetas { id nombre rinde insumos { articuloId cantidad } } tandas { id obtenido }
  anotaciones { id tipo montoCentavos categoria nota origen claveUnica } lista { id productoId cantidad }
} }`;
const SUBIR = `mutation($c: CambiosDeNegocioEntrada!) { sincronizarMiNegocio(cambios: $c) { recibidos hasta } }`;

type MiNegocio = {
  hasta: string;
  articulos: { id: string; nombre: string; detalle: string | null; rubro: string | null; medida: { envase: string; porEnvase: number | null; unidad: string }; precioVentaCentavos: number | null }[];
  movimientos: { id: string; claveUnica: string; cantidad: number; costoUnitarioCentavos: number | null; nota: string | null }[];
  ventas: { id: string; forma: string; lineas: { cantidad: number }[] }[];
  clientes: { id: string; nombre: string }[];
  fiados: { id: string; montoCentavos: number }[];
  recetas: { id: string; insumos: { cantidad: number }[] }[];
  anotaciones: { id: string; tipo: string; montoCentavos: number; categoria: string; nota: string | null; claveUnica: string }[];
};

test('lo que sube un celular lo baja otro del mismo cliente, y otro cliente nunca lo ve', async ({ request }) => {
  const celularA = await grafoDe(request, 'donarosa@abasto.bo');
  const n = randomUUID().slice(0, 8);
  const F = new Date().toISOString();
  const articuloId = `mano:queso-${n}`;
  const cambios = {
    articulos: [{ id: articuloId, nombre: `Queso menonita ${n}`, medida: { envase: 'kg', porEnvase: 1, unidad: 'kg' }, clase: 'COMPRADO', origen: 'OTRO_PROVEEDOR', proveedor: 'Feria', precioVentaCentavos: 4200, creadoEn: F, actualizadoEn: F, eliminado: false }],
    movimientos: [
      { id: `e-${n}`, articuloId, tipo: 'ENTRADA', cantidad: 5, costoUnitarioCentavos: 3500, origen: 'OTRO_PROVEEDOR', claveUnica: `manual:e-${n}`, fecha: F },
      { id: `c-${n}`, articuloId, tipo: 'CONSUMO', cantidad: -0.217391, origen: 'TANDA', claveUnica: `c-${n}`, fecha: F },
    ],
    clientes: [{ id: `k-${n}`, nombre: 'Don Pedro', creadoEn: F, actualizadoEn: F, eliminado: false }],
    ventas: [{ id: `v-${n}`, fecha: F, lineas: [{ articuloId, cantidad: 1.5, precioUnitarioCentavos: 4200, costoUnitarioCentavos: 3500 }], totalCentavos: 6300, costoCentavos: 5250, forma: 'FIADO', clienteId: `k-${n}`, anulada: false }],
    fiados: [{ id: `f-${n}`, clienteId: `k-${n}`, tipo: 'DEBE', montoCentavos: 6300, ventaId: `v-${n}`, fecha: F }],
    recetas: [{ id: `r-${n}`, articuloId: `hecho:${n}`, nombre: 'Salteñas de pollo', rinde: 100, insumos: [{ articuloId, cantidad: 4 }], actualizadoEn: F, eliminado: false }],
  };
  const subida = await celularA<{ sincronizarMiNegocio: { recibidos: number } }>(SUBIR, { c: cambios });
  expect(subida.sincronizarMiNegocio.recibidos).toBe(7);
  // Subir dos veces (la señal se cortó a mitad de camino) no duplica
  await celularA(SUBIR, { c: cambios });

  // Otro celular de Doña Rosa: entra y baja todo
  const celularB = await grafoDe(request, 'donarosa@abasto.bo');
  const todo = (await celularB<{ miNegocio: MiNegocio }>(MI_NEGOCIO, { desde: null })).miNegocio;
  expect(todo.articulos.filter((a) => a.id === articuloId)).toHaveLength(1);
  expect(todo.movimientos.filter((m) => m.claveUnica.endsWith(n)).map((m) => m.cantidad).sort()).toEqual([-0.217391, 5]);
  expect(todo.ventas.find((v) => v.id === `v-${n}`)?.lineas[0].cantidad).toBe(1.5);
  expect(todo.fiados.find((f) => f.id === `f-${n}`)?.montoCentavos).toBe(6300);
  expect(todo.recetas.find((r) => r.id === `r-${n}`)?.insumos).toEqual([{ articuloId, cantidad: 4 }]);

  // Desde la marca, solo lo nuevo. La marca queda 5 s antes de «ahora» (lo que se guardaba en ese momento vuelve a
  // bajar en lugar de perderse), así que se espera un poco más para que la subida de arriba quede antes de la marca
  await new Promise((r) => setTimeout(r, 6_000));
  const marca = (await celularB<{ miNegocio: MiNegocio }>(MI_NEGOCIO, { desde: null })).miNegocio.hasta;
  await celularA(SUBIR, { c: { anotaciones: [{ id: `g-${n}`, tipo: 'GASTO', montoCentavos: 1500, categoria: 'Luz', origen: 'MANUAL', claveUnica: `g-${n}`, fecha: F }] } });
  const nuevo = (await celularB<{ miNegocio: MiNegocio }>(MI_NEGOCIO, { desde: marca })).miNegocio;
  expect(nuevo.anotaciones.map((a) => a.id)).toContain(`g-${n}`);
  expect(nuevo.articulos.find((a) => a.id === articuloId)).toBeUndefined();

  // Otro cliente no ve nada de Doña Rosa
  const otro = (await (await grafoDe(request, 'lospozos@abasto.bo'))<{ miNegocio: MiNegocio }>(MI_NEGOCIO, { desde: null })).miNegocio;
  expect(otro.articulos.find((a) => a.id === articuloId)).toBeUndefined();

  // Lo que no sirve no se guarda y el mensaje dice por qué
  await expect(celularA(SUBIR, { c: { recetas: [{ ...cambios.recetas[0], id: `r2-${n}`, rinde: 0 }] } })).rejects.toThrow(/rendir más de cero/);
});

test('lo que Abasto entrega entra solo a Mi negocio del cliente, sin que la app haga nada', async ({ request }) => {
  test.setTimeout(120_000);
  const tienda = await grafoDe(request, 'donarosa@abasto.bo');
  const abasto = await grafoDe(request, 'ventas@abasto.bo');
  const { crearPedido } = await tienda<{ crearPedido: { id: string; codigo: string } }>(
    `mutation($e: CrearPedidoEntrada!) { crearPedido(entrada: $e) { id codigo } }`,
    { e: { clave: randomUUID(), mayoristaId: 'abasto', metodoPago: 'CONTRA_ENTREGA', lineas: [{ productoId: 'AB-101', presentacion: 'UNIDAD', cantidad: 2 }] } },
  );
  const estado = async () => (await tienda<{ misCompras: { id: string; estado: string }[] }>('query { misCompras { id estado } }')).misCompras.find((p) => p.id === crearPedido.id)?.estado;
  await expect.poll(estado, { timeout: 20_000 }).toBe('POR_CONFIRMAR');

  // Las mismas mutaciones que usan los botones del Panel (Confirmar, Preparar, Despachar, Marcar entregado). Los botones
  // en sí los recorre mi-negocio.spec.ts; aquí no se maneja la pantalla para no pisarse con esa prueba en paralelo
  await abasto(`mutation($id: ID!) { confirmarPedido(id: $id) { estado } }`, { id: crearPedido.id });
  for (const siguiente of ['EN_PREPARACION', 'DESPACHADO', 'ENTREGADO']) {
    const r = await abasto<{ avanzarEntrega: { estado: string } }>(`mutation($id: ID!) { avanzarEntrega(id: $id) { estado } }`, { id: crearPedido.id });
    expect(r.avanzarEntrega.estado).toBe(siguiente);
  }

  // Nadie abrió la app: Cobros lo registró al escuchar pedido.entregado
  const clave = `pedido:${crearPedido.id}:AB-101:UNIDAD`;
  const leer = async () => (await tienda<{ miNegocio: MiNegocio }>(MI_NEGOCIO, { desde: null })).miNegocio;
  await expect.poll(async () => (await leer()).movimientos.some((m) => m.claveUnica === clave), { timeout: 20_000 }).toBe(true);
  const negocio = await leer();
  expect(negocio.movimientos.find((m) => m.claveUnica === clave)).toMatchObject({ cantidad: 2, costoUnitarioCentavos: 28500, nota: `Pedido ${crearPedido.codigo}` });
  expect(negocio.articulos.find((a) => a.id === 'abasto:AB-101')).toMatchObject({
    nombre: 'Harina de trigo',
    detalle: 'quintal 46 kg',
    rubro: 'Harinas y panificación',
    medida: { envase: 'quintal', porEnvase: 46, unidad: 'kg' },
  });
  expect(negocio.anotaciones.find((a) => a.claveUnica === `pedido:${crearPedido.id}`)).toMatchObject({ tipo: 'GASTO', montoCentavos: 57000, categoria: 'Compras en Abasto', nota: `Pedido ${crearPedido.codigo}` });
});
