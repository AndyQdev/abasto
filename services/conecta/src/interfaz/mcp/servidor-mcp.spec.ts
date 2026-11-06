import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { BitacoraEnMemoria } from '../../aplicacion/bitacora.en-memoria.js';
import { RegistroEnMemoria } from '../../aplicacion/registro.en-memoria.js';
import { SincronizarLote } from '../../aplicacion/sincronizar-lote.js';
import { crearServidorMcp } from './servidor-mcp.js';

const SESION = { token: 'token-de-dr', tiendaId: 'dr' };

async function armar() {
  const creados: unknown[] = [];
  const tokens: string[] = [];
  const bitacora = new BitacoraEnMemoria();
  const sincronizar = new SincronizarLote(
    new RegistroEnMemoria(),
    {
      aplicar: async (op, token) => {
        tokens.push(token);
        creados.push(op.datos);
        return { id: 'p1', codigo: 'A-1', estado: 'PENDIENTE' };
      },
    },
    bitacora,
  );
  const consultas = {
    mayoristas: async () => [{ id: 'abasto', nombre: 'Abasto' }],
    productos: async (_t: string, f: { busqueda?: string }) => [{ id: 'AB-101', nombre: `Harina (${f.busqueda})` }],
    pedido: async (_t: string, id: string) => (id === 'p1' ? { id: 'p1', codigo: 'A-1' } : null),
    misCompras: async () => [{ id: 'p1' }],
  };
  const servidor = crearServidorMcp(consultas, sincronizar, SESION);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const cliente = new Client({ name: 'prueba', version: '1.0.0' });
  await Promise.all([servidor.connect(a), cliente.connect(b)]);
  return { cliente, creados, tokens, bitacora };
}

const leer = (r: unknown) => JSON.parse((r as { content: { text: string }[] }).content[0]!.text) as Record<string, unknown>;
const PEDIDO = { mayoristaId: 'abasto', metodoPago: 'CONTRA_ENTREGA', lineas: [{ productoId: 'AB-101', presentacion: 'UNIDAD', cantidad: 2 }] };

describe('CU-10 · MCP de compras', () => {
  it('ofrece las herramientas para buscar y comprar, y marca cuáles solo leen', async () => {
    const { cliente } = await armar();
    const { tools } = await cliente.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['buscar_productos', 'crear_pedido', 'mis_pedidos', 'ver_mayoristas', 'ver_pedido']);
    expect(tools.find((t) => t.name === 'buscar_productos')?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find((t) => t.name === 'crear_pedido')?.annotations?.readOnlyHint).toBe(false);
  });

  it('busca con el token de la tienda', async () => {
    const { cliente } = await armar();
    const r = await cliente.callTool({ name: 'buscar_productos', arguments: { busqueda: 'harina' } });
    expect(JSON.parse((r as { content: { text: string }[] }).content[0]!.text)).toEqual([{ id: 'AB-101', nombre: 'Harina (harina)' }]);
  });

  it('crea el pedido con la idempotencia de Conecta: repetir la clave no crea otro', async () => {
    const { cliente, creados, tokens, bitacora } = await armar();
    const clave = randomUUID();
    const primero = leer(await cliente.callTool({ name: 'crear_pedido', arguments: { clave, ...PEDIDO } }));
    const segundo = leer(await cliente.callTool({ name: 'crear_pedido', arguments: { clave, ...PEDIDO } }));
    expect(primero).toMatchObject({ estado: 'aplicada', pedido: { codigo: 'A-1' } });
    expect(segundo).toMatchObject({ estado: 'repetida', pedido: { codigo: 'A-1' } });
    expect(creados).toHaveLength(1);
    expect(tokens).toEqual([SESION.token]);
    expect(bitacora.entradas[0]).toMatchObject({ origen: 'mcp', tiendaId: 'dr', mayoristaId: 'abasto' });
  });

  it('la misma clave con otro contenido es un error, no otro pedido', async () => {
    const { cliente, creados } = await armar();
    const clave = randomUUID();
    await cliente.callTool({ name: 'crear_pedido', arguments: { clave, ...PEDIDO } });
    const r = await cliente.callTool({ name: 'crear_pedido', arguments: { clave, ...PEDIDO, metodoPago: 'QR' } });
    expect(r.isError).toBe(true);
    expect(creados).toHaveLength(1);
  });

  it('rechaza datos que no cumplen: una clave que no es UUID no llega a Pedidos', async () => {
    const { cliente, creados } = await armar();
    const r = await cliente.callTool({ name: 'crear_pedido', arguments: { clave: 'uno', ...PEDIDO } });
    expect(r.isError).toBe(true);
    expect(creados).toEqual([]);
  });

  it('un pedido que no es de la tienda se responde como inexistente', async () => {
    const { cliente } = await armar();
    const r = await cliente.callTool({ name: 'ver_pedido', arguments: { id: 'ajeno' } });
    expect(r.isError).toBe(true);
    expect((r as { content: { text: string }[] }).content[0]!.text).toContain('no existe');
  });
});
