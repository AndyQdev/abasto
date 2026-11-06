import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * CU-10: una tienda conecta su e-commerce sin nadie al lado. Saca una llave con su sesión, y con esa llave lee el
 * catálogo, compra (sin duplicar al reintentar), recibe avisos firmados y un agente compra por MCP. Al revocarla, deja de servir.
 */
const CONECTA = 'http://localhost:8084';
const ROUTER = 'http://localhost:4000/';
const TOKEN = 'http://localhost:8180/realms/abasto/protocol/openid-connect/token';

async function tokenDe(request: APIRequestContext, correo: string) {
  const r = await request.post(TOKEN, { form: { grant_type: 'password', client_id: 'abasto-pruebas', username: correo, password: 'abasto123' } });
  return ((await r.json()) as { access_token: string }).access_token;
}

const con = (credencial: string) => ({ authorization: `Bearer ${credencial}` });

interface Aviso {
  cuerpo: string;
  firma: string;
  fecha: string;
  entrega: string;
  evento: string;
}

/** Un e-commerce de mentira que recibe los webhooks. Conecta llega a él por host.docker.internal. */
function tiendaDePrueba(): Promise<{ servidor: Server; puerto: number; avisos: Aviso[]; responder: { estado: number } }> {
  const avisos: Aviso[] = [];
  const responder = { estado: 200 };
  const servidor = createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (c) => (cuerpo += c));
    req.on('end', () => {
      avisos.push({
        cuerpo,
        firma: String(req.headers['x-abasto-firma']),
        fecha: String(req.headers['x-abasto-fecha']),
        entrega: String(req.headers['x-abasto-entrega']),
        evento: String(req.headers['x-abasto-evento']),
      });
      res.writeHead(responder.estado).end();
    });
  });
  return new Promise((listo) => servidor.listen(0, '0.0.0.0', () => listo({ servidor, puerto: (servidor.address() as AddressInfo).port, avisos, responder })));
}

test.describe('CU-10 · Conectar un e-commerce', () => {
  test('llave, catálogo, pedido sin duplicar, webhook firmado, MCP y revocar', async ({ page, request }) => {
    test.setTimeout(180_000);
    const sesion = await tokenDe(request, 'donarosa@abasto.bo');
    const mayorista = await tokenDe(request, 'ventas@abasto.bo');
    const { servidor, puerto, avisos, responder } = await tiendaDePrueba();

    // Limpia lo que haya quedado de otra corrida: cada tienda tiene un máximo de llaves y webhooks
    for (const l of (await (await request.get(`${CONECTA}/v1/llaves`, { headers: con(sesion) })).json()) as { id: string }[]) {
      await request.delete(`${CONECTA}/v1/llaves/${l.id}`, { headers: con(sesion) });
    }
    for (const w of (await (await request.get(`${CONECTA}/v1/webhooks`, { headers: con(sesion) })).json()) as { id: string }[]) {
      await request.delete(`${CONECTA}/v1/webhooks/${w.id}`, { headers: con(sesion) });
    }

    try {
      // La tienda saca la llave. La lista nunca muestra el secreto
      const creada = await request.post(`${CONECTA}/v1/llaves`, { headers: con(sesion), data: { nombre: 'Mi WooCommerce' } });
      expect(creada.ok(), await creada.text()).toBe(true);
      const { llave, datos } = (await creada.json()) as { llave: string; datos: { id: string } };
      expect(llave).toMatch(/^abk_/);
      const lista = await (await request.get(`${CONECTA}/v1/llaves`, { headers: con(sesion) })).text();
      expect(lista).toContain('Mi WooCommerce');
      expect(lista).not.toContain(llave.split('_')[2]);

      // Una llave no puede sacar otras llaves, y una inventada no entra
      expect((await request.post(`${CONECTA}/v1/llaves`, { headers: con(llave), data: { nombre: 'Otra' } })).status()).toBe(403);
      expect((await request.get(`${CONECTA}/v1/productos`, { headers: con(`${llave.slice(0, -3)}abc`) })).status()).toBe(401);

      // Con la llave lee el catálogo con los precios de la tienda, y Abasto está entre los mayoristas
      const mayoristas = (await (await request.get(`${CONECTA}/v1/mayoristas`, { headers: con(llave) })).json()) as { id: string; deLaCasa: boolean }[];
      expect(mayoristas.find((m) => m.deLaCasa)?.id).toBe('abasto');
      const respuesta = await request.get(`${CONECTA}/v1/productos?mayoristaId=abasto&busqueda=harina`, { headers: con(llave) });
      expect(respuesta.ok(), await respuesta.text()).toBe(true);
      const productos = (await respuesta.json()) as { id: string; precioVisible: boolean; escalas: { presentacion: string; precioUnitario: { centavos: number } | null }[] }[];
      const harina = productos[0];
      if (!harina) throw new Error('No hay harina en el catálogo');
      expect(harina.precioVisible).toBe(true);
      expect(harina.escalas[0]?.precioUnitario?.centavos).toBeGreaterThan(0);

      // Registra a dónde avisarle. «Probar» dice al momento si llegó, con la firma correcta
      const webhook = await request.post(`${CONECTA}/v1/webhooks`, { headers: con(llave), data: { url: `http://host.docker.internal:${puerto}/abasto` } });
      expect(webhook.ok(), await webhook.text()).toBe(true);
      const { secreto, datos: datosDelWebhook } = (await webhook.json()) as { secreto: string; datos: { id: string } };
      const prueba = (await (await request.post(`${CONECTA}/v1/webhooks/${datosDelWebhook.id}/probar`, { headers: con(llave) })).json()) as { estado: string };
      expect(prueba.estado).toBe('entregada');
      const avisoDePrueba = avisos[0];
      if (!avisoDePrueba) throw new Error('No llegó el aviso de prueba');
      expect(avisoDePrueba.firma).toBe(`sha256=${createHmac('sha256', secreto).update(`${avisoDePrueba.fecha}.${avisoDePrueba.cuerpo}`).digest('hex')}`);

      // Compra con la llave; el reintento devuelve lo mismo y no crea otro
      const clave = randomUUID();
      const pedir = () =>
        request.post(`${CONECTA}/v1/pedidos`, {
          headers: { ...con(llave), 'idempotency-key': clave, 'x-abasto-origen': 'tienda-en-linea' },
          data: { mayoristaId: 'abasto', metodoPago: 'CONTRA_ENTREGA', lineas: [{ productoId: harina.id, presentacion: harina.escalas[0]?.presentacion, cantidad: 1 }] },
        });
      const primero = (await (await pedir()).json()) as { estado: string; error?: string; respuesta: { id: string; codigo: string } };
      expect(primero.estado, primero.error).toBe('aplicada');
      const segundo = (await (await pedir()).json()) as { estado: string; respuesta: { codigo: string } };
      expect(segundo.estado).toBe('repetida');
      expect(segundo.respuesta.codigo).toBe(primero.respuesta.codigo);
      const { id: pedidoId, codigo } = primero.respuesta;

      // Lee el pedido; otra tienda no puede
      const leido = (await (await request.get(`${CONECTA}/v1/pedidos/${pedidoId}`, { headers: con(llave) })).json()) as { codigo: string };
      expect(leido.codigo).toBe(codigo);
      const ajena = await tokenDe(request, 'lospozos@abasto.bo');
      expect((await request.get(`${CONECTA}/v1/pedidos/${pedidoId}`, { headers: con(ajena) })).status()).toBe(404);

      // La saga avanza y el mayorista confirma: el e-commerce recibe el aviso de su pedido, firmado
      await expect
        .poll(async () => avisos.some((a) => a.cuerpo.includes(codigo) && a.evento.startsWith('pedido.')), { timeout: 30_000, message: 'esperaba el primer aviso del pedido' })
        .toBe(true);
      await expect
        .poll(
          async () => {
            const r = await request.post(ROUTER, { headers: con(mayorista), data: { query: 'mutation($id: ID!) { confirmarPedido(id: $id) { estado } }', variables: { id: pedidoId } } });
            return ((await r.json()) as { data?: { confirmarPedido?: { estado: string } } }).data?.confirmarPedido?.estado;
          },
          { timeout: 30_000, intervals: [1000, 2000] },
        )
        .toBe('CONFIRMADO');
      await expect.poll(() => avisos.some((a) => a.evento === 'pedido.confirmado' && a.cuerpo.includes(codigo)), { timeout: 30_000 }).toBe(true);
      const confirmado = avisos.find((a) => a.evento === 'pedido.confirmado' && a.cuerpo.includes(codigo));
      if (!confirmado) throw new Error('No llegó pedido.confirmado');
      expect(confirmado.firma).toBe(`sha256=${createHmac('sha256', secreto).update(`${confirmado.fecha}.${confirmado.cuerpo}`).digest('hex')}`);
      expect(new Set(avisos.map((a) => a.entrega)).size).toBe(avisos.length);

      // Si el e-commerce está caído, queda anotado para reintentar
      responder.estado = 500;
      await request.post(`${CONECTA}/v1/webhooks/${datosDelWebhook.id}/probar`, { headers: con(llave) });
      const entregas = (await (await request.get(`${CONECTA}/v1/entregas`, { headers: con(llave) })).json()) as { estado: string; ultimoError: string | null; tipo: string }[];
      expect(entregas.find((e) => e.tipo === 'webhook.prueba' && e.estado === 'pendiente')?.ultimoError).toBe('Respondió 500');
      responder.estado = 200;

      // Un agente compra por MCP con la misma llave
      const mcp = async (metodo: string, params: unknown) => {
        const r = await request.post(`${CONECTA}/mcp`, {
          headers: { ...con(llave), accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
          data: { jsonrpc: '2.0', id: 1, method: metodo, params },
        });
        expect(r.ok(), await r.text()).toBe(true);
        return (await r.json()) as { result: { tools?: { name: string }[]; content?: { text: string }[]; isError?: boolean } };
      };
      const herramientas = await mcp('tools/list', {});
      expect(herramientas.result.tools?.map((t) => t.name)).toContain('crear_pedido');
      const claveMcp = randomUUID();
      const argumentos = { clave: claveMcp, mayoristaId: 'abasto', metodoPago: 'CONTRA_ENTREGA', lineas: [{ productoId: harina.id, presentacion: harina.escalas[0]?.presentacion, cantidad: 1 }] };
      const porMcp = await mcp('tools/call', { name: 'crear_pedido', arguments: argumentos });
      expect(porMcp.result.isError, porMcp.result.content?.[0]?.text).toBeFalsy();
      const pedidoMcp = JSON.parse(porMcp.result.content?.[0]?.text ?? '{}') as { estado: string; pedido: { codigo: string } };
      expect(pedidoMcp.estado).toBe('aplicada');
      const repetidoMcp = await mcp('tools/call', { name: 'crear_pedido', arguments: argumentos });
      expect(JSON.parse(repetidoMcp.result.content?.[0]?.text ?? '{}')).toMatchObject({ estado: 'repetida', pedido: { codigo: pedidoMcp.pedido.codigo } });

      // Sin credencial, MCP no responde
      expect((await request.post(`${CONECTA}/mcp`, { data: {} })).status()).toBe(401);

      // El mayorista ve de dónde entró cada uno en Panel › Conecta
      await page.goto('http://localhost:5170/conecta');
      await entrarComo(page, 'ventas@abasto.bo');
      await expect(page.getByRole('article', { name: `${codigo} por Tienda en línea` }).first()).toBeVisible();
      await expect(page.getByRole('article', { name: `${pedidoMcp.pedido.codigo} por Agente (MCP)` }).first()).toBeVisible();

      // El Superadmin ve la llave y el webhook, sin secretos
      const admin = await tokenDe(request, 'admin@abasto.bo');
      const integraciones = await (await request.get(`${CONECTA}/v1/admin/integraciones`, { headers: con(admin) })).text();
      expect(integraciones).toContain('Mi WooCommerce');
      expect(integraciones).not.toContain(secreto);
      expect((await request.get(`${CONECTA}/v1/admin/integraciones`, { headers: con(sesion) })).status()).toBe(403);

      // Al revocarla deja de servir al momento, y su cuenta de Keycloak ya no existe
      expect((await request.delete(`${CONECTA}/v1/llaves/${datos.id}`, { headers: con(sesion) })).status()).toBe(204);
      expect((await request.get(`${CONECTA}/v1/productos`, { headers: con(llave) })).status()).toBe(401);
      expect((await request.post(`${CONECTA}/mcp`, { headers: con(llave), data: {} })).status()).toBe(401);
    } finally {
      for (const w of (await (await request.get(`${CONECTA}/v1/webhooks`, { headers: con(sesion) })).json()) as { id: string }[]) {
        await request.delete(`${CONECTA}/v1/webhooks/${w.id}`, { headers: con(sesion) });
      }
      servidor.close();
    }
  });

  test('una tienda no recibe el pedido de otra aunque use su misma clave', async ({ request }) => {
    const clave = randomUUID();
    const crear = (token: string) =>
      request.post(ROUTER, {
        headers: con(token),
        data: {
          query: 'mutation($e: CrearPedidoEntrada!) { crearPedido(entrada: $e) { codigo } }',
          variables: { e: { clave, mayoristaId: 'abasto', metodoPago: 'CONTRA_ENTREGA', lineas: [{ productoId: 'AB-101', presentacion: 'UNIDAD', cantidad: 1 }] } },
        },
      });
    const primera = (await (await crear(await tokenDe(request, 'donarosa@abasto.bo'))).json()) as { data: { crearPedido: { codigo: string } } };
    expect(primera.data.crearPedido.codigo).toMatch(/^A-/);
    const otra = (await (await crear(await tokenDe(request, 'lospozos@abasto.bo'))).json()) as { data?: { crearPedido?: unknown }; errors?: { message: string }[] };
    expect(otra.data?.crearPedido ?? null).toBeNull();
    expect(JSON.stringify(otra.errors)).not.toContain(primera.data.crearPedido.codigo);
  });
});
