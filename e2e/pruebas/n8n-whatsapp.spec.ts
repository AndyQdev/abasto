import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * CU-11 contra el n8n de verdad: el mensaje entra por el webhook, n8n lo interpreta y lo manda a Conecta.
 * Necesita `pnpm n8n`; sin n8n arriba, se salta.
 */
const N8N = 'http://localhost:5678';
const WEBHOOK = `${N8N}/webhook/pedido-whatsapp`;

async function n8nArriba(request: APIRequestContext) {
  try {
    return (await request.get(`${N8N}/healthz`, { timeout: 2000 })).ok();
  } catch {
    return false;
  }
}

interface Respuesta {
  clave: string;
  estado: string;
  error?: string;
  respuesta?: { id: string; codigo: string };
}

const mensaje = (request: APIRequestContext, id: string, cuerpo: Record<string, unknown>) =>
  request.post(WEBHOOK, { data: { mensajeId: id, telefono: '+59170000000', ...cuerpo } });

test('CU-11: el mismo mensaje entra una sola vez y se le puede comprar a Abasto con sus códigos', async ({ request }) => {
  test.skip(!(await n8nArriba(request)), 'Necesita pnpm n8n');
  const id = `wamid.e2e.${Date.now()}`;

  // Abasto tiene códigos de 3 dígitos y no fía por defecto: el pedido va contra entrega
  const primero = (await (await mensaje(request, id, { texto: '2 unidades AB-101, 1 unidad AB-102' })).json()) as Respuesta;
  expect(primero.estado, primero.error).toBe('aplicada');
  expect(primero.respuesta?.codigo).toMatch(/^A-/);

  // WhatsApp reintenta el mismo mensaje: misma respuesta y ningún pedido nuevo
  const segundo = (await (await mensaje(request, id, { texto: '2 unidades AB-101, 1 unidad AB-102' })).json()) as Respuesta;
  expect(segundo.estado).toBe('repetida');
  expect(segundo.respuesta?.codigo).toBe(primero.respuesta?.codigo);
});

test('CU-11: un mayorista afiliado se elige en el mensaje, con sus códigos de 4 dígitos', async ({ request }) => {
  test.skip(!(await n8nArriba(request)), 'Necesita pnpm n8n');
  const r = (await (await mensaje(request, `wamid.e2e.lp.${Date.now()}`, { mayoristaId: 'lp', metodoPago: 'CREDITO', texto: '1 cuarta LP-0004' })).json()) as Respuesta;
  expect(r.estado, r.error).toBe('aplicada');
});

test('CU-11: un mensaje que no es un pedido no crea nada y lo dice', async ({ request }) => {
  test.skip(!(await n8nArriba(request)), 'Necesita pnpm n8n');
  const r = (await (await mensaje(request, `wamid.e2e.hola.${Date.now()}`, { texto: 'Hola, ¿tienen arroz?' })).json()) as Respuesta;
  expect(r.estado).toBe('rechazada');
  expect(r.respuesta).toBeUndefined();
});
