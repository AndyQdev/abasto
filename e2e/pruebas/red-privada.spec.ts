import { expect, test, type APIRequestContext } from '@playwright/test';

const ROUTER = 'http://localhost:4000/';
const TOKEN = 'http://localhost:8180/realms/abasto/protocol/openid-connect/token';

/** Token de un usuario de prueba con el cliente abasto-pruebas (solo existe en desarrollo). */
async function tokenDe(request: APIRequestContext, correo: string) {
  const r = await request.post(TOKEN, {
    form: { grant_type: 'password', client_id: 'abasto-pruebas', username: correo, password: 'abasto123' },
  });
  expect(r.ok()).toBe(true);
  return ((await r.json()) as { access_token: string }).access_token;
}

test.describe('Red privada de precios (cita 2)', () => {
  test('una tienda sin relación nunca recibe precios de un mayorista afiliado por GraphQL', async ({ request }) => {
    const token = await tokenDe(request, 'donarosa@abasto.bo');
    const r = await request.post(ROUTER, {
      headers: { authorization: `Bearer ${token}` },
      data: { query: '{ productos { mayorista { id relacion deLaCasa } precioVisible escalas { precioUnitario { centavos } } } }' },
    });
    const { productos } = (await r.json()).data as {
      productos: { mayorista: { id: string; relacion: string; deLaCasa: boolean }; precioVisible: boolean; escalas: { precioUnitario: unknown }[] }[];
    };
    // Abasto (vendedor de la casa) le muestra precios a todas; la red privada es para los mayoristas afiliados
    const sinRelacion = productos.filter((p) => p.mayorista.relacion !== 'APROBADA' && !p.mayorista.deLaCasa);
    // Corre antes de la aprobación de abajo: La Ramada todavía no aprobó a Doña Rosa
    expect(sinRelacion.length).toBeGreaterThan(0);
    for (const p of sinRelacion) {
      expect(p.precioVisible).toBe(false);
      expect(p.escalas.every((e) => e.precioUnitario === null)).toBe(true);
    }
  });

  test('pedir ser cliente → el mayorista aprueba → la tienda ve los precios de su lista', async ({ request }) => {
    // preparar.ts borra la relación de Doña Rosa con La Ramada antes de correr
    const grafo = async (correo: string, query: string) => {
      const r = await request.post(ROUTER, { headers: { authorization: `Bearer ${await tokenDe(request, correo)}` }, data: { query } });
      return (await r.json()).data;
    };
    const hidratante = async () =>
      (await grafo('donarosa@abasto.bo', '{ productos(mayoristaId: "lr") { id precioVisible escalas { precioUnitario { centavos } } } }')).productos.find(
        (p: { id: string }) => p.id === 'LR-SH400',
      );

    // Sin relación: el producto se ve, el precio no
    expect((await hidratante()).precioVisible).toBe(false);
    expect((await grafo('donarosa@abasto.bo', 'mutation { pedirSerCliente(mayoristaId: "lr") { estado } }')).pedirSerCliente.estado).toBe('SOLICITADA');

    // La Ramada la aprueba con la lista NUEVOS (Gestión · Clientes)
    expect((await grafo('laramada@abasto.bo', 'mutation { aprobarCliente(tiendaId: "dr", lista: NUEVOS) { estado lista } }')).aprobarCliente).toEqual({
      estado: 'APROBADA',
      lista: 'NUEVOS',
    });

    // Doña Rosa ve los precios de La Ramada (NUEVOS = 100 %)
    const conPrecio = await hidratante();
    expect(conPrecio.precioVisible).toBe(true);
    expect(conPrecio.escalas.map((e: { precioUnitario: { centavos: number } }) => e.precioUnitario.centavos)).toEqual([2100, 1950, 1825]);
  });
});
