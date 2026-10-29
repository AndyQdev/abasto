import { expect, test, type APIRequestContext } from '@playwright/test';
import { entrarComo } from './sesion';

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

test.describe('Mercado · red privada (cita 2)', () => {
  test('una tienda sin relación nunca recibe precios por GraphQL', async ({ request }) => {
    const token = await tokenDe(request, 'donarosa@abasto.bo');
    const r = await request.post(ROUTER, {
      headers: { authorization: `Bearer ${token}` },
      data: { query: '{ productos { mayorista { id relacion } precioVisible escalas { precioUnitario { centavos } } } }' },
    });
    const { productos } = (await r.json()).data as {
      productos: { mayorista: { id: string; relacion: string }; precioVisible: boolean; escalas: { precioUnitario: unknown }[] }[];
    };
    const sinRelacion = productos.filter((p) => p.mayorista.relacion !== 'APROBADA');
    // Corre antes de la aprobación de abajo: La Ramada todavía no aprobó a Doña Rosa
    expect(sinRelacion.length).toBeGreaterThan(0);
    for (const p of sinRelacion) {
      expect(p.precioVisible).toBe(false);
      expect(p.escalas.every((e) => e.precioUnitario === null)).toBe(true);
    }
  });

  test('pedir ser cliente → el mayorista aprueba → la tienda ve los precios de su lista', async ({ page, request }) => {
    // preparar.ts borra la relación de Doña Rosa con La Ramada antes de correr
    await page.goto('http://localhost:5173/');
    await entrarComo(page, 'donarosa@abasto.bo');

    await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Buscar' }).click();
    await page.getByRole('group', { name: 'Buscar en' }).getByRole('button', { name: 'Mayoristas' }).click();
    await page.getByRole('button', { name: /Importadora La Ramada/ }).click();

    // Sin relación: el catálogo se ve, el precio no
    await expect(page.getByText('Todavía no eres cliente de La Ramada')).toBeVisible();
    await expect(page.getByText('Precio para clientes')).toBeVisible();
    await page.getByRole('button', { name: 'Pedir ser cliente' }).click();
    await expect(page.getByText('Solicitud enviada · por confirmar')).toBeVisible();

    // La Ramada la aprueba con la lista NUEVOS (la pantalla Clientes de Gestión es la tarjeta CU-04 de Jhoel)
    const token = await tokenDe(request, 'laramada@abasto.bo');
    const r = await request.post(ROUTER, {
      headers: { authorization: `Bearer ${token}` },
      data: { query: 'mutation { aprobarCliente(tiendaId: "dr", lista: NUEVOS) { estado lista } }' },
    });
    expect((await r.json()).data.aprobarCliente).toEqual({ estado: 'APROBADA', lista: 'NUEVOS' });

    // Al volver a abrir Mercado, Doña Rosa ve los precios de La Ramada (NUEVOS = 100 %)
    await page.reload();
    await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Buscar' }).click();
    await page.getByLabel('Buscar productos o mayoristas').fill('hidratante');
    await expect(page.getByText('Bs 21,00')).toBeVisible();
    await page.getByRole('button', { name: 'Ver Shampoo 400 ml · Hidratante' }).click();
    await expect(page.getByRole('heading', { name: 'Precios por volumen' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito · Bs 234,00/ })).toBeVisible();
  });
});
