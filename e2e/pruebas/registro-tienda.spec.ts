import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * CU-15: una tienda se registra con su celular y un código, sin correo ni contraseña, y lo que elige queda en la base:
 * al volver a entrar con el mismo número se reconoce. El código vuelve en la respuesta mientras no esté WhatsApp.
 */
const ROUTER = 'http://localhost:4000/';

async function grafo<T>(request: APIRequestContext, query: string, variables: Record<string, unknown> = {}, token?: string) {
  const r = await request.post(ROUTER, { headers: token ? { authorization: `Bearer ${token}` } : {}, data: { query, variables } });
  return (await r.json()) as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
}

const PEDIR = 'mutation($t: String!) { pedirCodigo(telefono: $t) { telefono esNuevo codigoDePrueba } }';
const ENTRAR = 'mutation($t: String!, $c: String!, $n: String) { entrarConCodigo(telefono: $t, codigo: $c, nombre: $n) { tokenDeAcceso cuentaNueva nombre } }';

type Envio = { pedirCodigo: { esNuevo: boolean; codigoDePrueba: string } };
type Entrada = { entrarConCodigo: { tokenDeAcceso: string; cuentaNueva: boolean; nombre: string } };

test('CU-15: registrarse con el celular, elegir el negocio y volver a entrar con el mismo número', async ({ request }) => {
  // Un número nuevo en cada corrida: 7 más 7 dígitos que salen del reloj
  const celular = `7${String(Date.now()).slice(-7)}`;

  const primero = await grafo<Envio>(request, PEDIR, { t: celular });
  expect(primero.errors).toBeUndefined();
  expect(primero.data?.pedirCodigo.esNuevo).toBe(true);
  const codigo = primero.data?.pedirCodigo.codigoDePrueba as string;

  // Un código equivocado no entra
  const malo = await grafo<Entrada>(request, ENTRAR, { t: celular, c: codigo === '000000' ? '111111' : '000000' });
  expect(malo.errors?.[0]?.extensions?.code).toBe('CODIGO_INCORRECTO');

  // La primera vez pide el nombre, y el código sigue vigente
  const sinNombre = await grafo<Entrada>(request, ENTRAR, { t: celular, c: codigo });
  expect(sinNombre.errors?.[0]?.extensions?.code).toBe('NECESITA_NOMBRE');

  const entra = await grafo<Entrada>(request, ENTRAR, { t: celular, c: codigo, n: 'Tienda de Prueba' });
  expect(entra.errors).toBeUndefined();
  expect(entra.data?.entrarConCodigo).toMatchObject({ cuentaNueva: true, nombre: 'Tienda de Prueba' });
  const token = entra.data?.entrarConCodigo.tokenDeAcceso as string;

  // Elige para qué compra y ya puede ver los precios de Abasto
  const negocio = await grafo<{ elegirTipoDeNegocio: { tipo: string } }>(request, 'mutation { elegirTipoDeNegocio(tipo: "tienda") { tipo } }', {}, token);
  expect(negocio.data?.elegirTipoDeNegocio.tipo).toBe('tienda');
  const productos = await grafo<{ productos: { precioVisible: boolean }[] }>(request, 'query { productos(mayoristaId: "abasto", busqueda: "harina") { precioVisible } }', {}, token);
  expect(productos.data?.productos[0]?.precioVisible).toBe(true);

  // Vuelve a entrar con el mismo número, como en otro celular. Hay que esperar para pedir otro código
  let otroCodigo = '';
  await expect
    .poll(
      async () => {
        const r = await grafo<Envio>(request, PEDIR, { t: celular });
        if (r.data) otroCodigo = r.data.pedirCodigo.codigoDePrueba;
        return r.errors?.[0]?.extensions?.code ?? r.data?.pedirCodigo.esNuevo;
      },
      { timeout: 90_000, intervals: [5000] },
    )
    .toBe(false);

  // No pide el nombre y lo que eligió sigue en la base
  const otraVez = await grafo<Entrada>(request, ENTRAR, { t: celular, c: otroCodigo });
  expect(otraVez.data?.entrarConCodigo).toMatchObject({ cuentaNueva: false, nombre: 'Tienda de Prueba' });
  const guardado = await grafo<{ miTipoDeNegocio: { tipo: string } }>(request, 'query { miTipoDeNegocio { tipo } }', {}, otraVez.data?.entrarConCodigo.tokenDeAcceso);
  expect(guardado.data?.miTipoDeNegocio.tipo).toBe('tienda');
});

test('CU-15: un celular que no es de Bolivia no se registra', async ({ request }) => {
  const r = await grafo(request, PEDIR, { t: '1234567' });
  expect(r.errors?.[0]?.extensions?.code).toBe('TELEFONO_INVALIDO');
});
