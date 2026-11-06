import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SincronizarLote } from '../../aplicacion/sincronizar-lote.js';
import type { ConsultasDeCompra } from '../../dominio/puertos.js';

export interface SesionDeMcp {
  token: string;
  tiendaId: string;
}

const texto = (valor: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(valor) }] });
const falla = (motivo: string) => ({ isError: true, content: [{ type: 'text' as const, text: motivo }] });

async function leyendo<T>(leer: () => Promise<T>) {
  try {
    return texto(await leer());
  } catch (e) {
    return falla((e as Error).message);
  }
}

/**
 * MCP de compras (CU-10): deja que un agente busque y compre en nombre de una tienda. Se crea uno por petición con el
 * token de quien llama, así cada compra queda atada a su empresa y a sus precios. No lee ni escribe nada por su cuenta:
 * pasa por los mismos caminos que la API (el Router y la idempotencia de Conecta).
 */
export function crearServidorMcp(consultas: ConsultasDeCompra, sincronizar: SincronizarLote, sesion: SesionDeMcp): McpServer {
  const servidor = new McpServer({ name: 'abasto-compras', version: '1.0.0' });
  const lectura = { readOnlyHint: true, openWorldHint: false };

  servidor.registerTool(
    'ver_mayoristas',
    {
      title: 'Ver mayoristas',
      description: 'Los mayoristas a los que puede comprarle esta tienda, con su id. deLaCasa es Abasto; relacion dice si la aprobó como cliente.',
      inputSchema: { busqueda: z.string().max(100).optional().describe('Parte del nombre') },
      annotations: lectura,
    },
    async ({ busqueda }) => leyendo(() => consultas.mayoristas(sesion.token, busqueda)),
  );

  servidor.registerTool(
    'buscar_productos',
    {
      title: 'Buscar productos',
      description:
        'Busca en el catálogo. Cada producto trae su id y sus escalas: presentación (UNIDAD, CUARTA, DOCENA, CAJA, FARDO), unidades que trae y precio por unidad. ' +
        'Si precioVisible es false, esta tienda todavía no es cliente de ese mayorista. Si precioPorConfirmar es true, el precio es de referencia.',
      inputSchema: {
        busqueda: z.string().max(100).optional().describe('Nombre o parte del nombre, por ejemplo «arroz»'),
        mayoristaId: z.string().max(100).optional().describe('Solo los de este mayorista'),
      },
      annotations: lectura,
    },
    async ({ busqueda, mayoristaId }) => leyendo(() => consultas.productos(sesion.token, { busqueda, mayoristaId })),
  );

  servidor.registerTool(
    'crear_pedido',
    {
      title: 'Crear un pedido',
      description:
        'Hace un pedido real a un mayorista. Confírmalo con la persona antes de llamar. Usa una clave nueva (UUID) por pedido y repite la misma si reintentas: ' +
        'así nunca se crea dos veces. El pedido queda esperando la confirmación del mayorista; míralo con ver_pedido.',
      inputSchema: {
        clave: z.uuid().describe('UUID que identifica este pedido. Repetirlo no crea otro'),
        mayoristaId: z.string().min(1).max(100),
        metodoPago: z.enum(['QR', 'CREDITO', 'CONTRA_ENTREGA']),
        lineas: z
          .array(
            z.object({
              productoId: z.string().min(1).max(100),
              presentacion: z.enum(['UNIDAD', 'CUARTA', 'DOCENA', 'CAJA', 'FARDO']),
              cantidad: z.number().int().min(1).max(10_000),
            }),
          )
          .min(1)
          .max(100),
        entrega: z
          .object({ calle: z.string().min(1).max(200), zona: z.string().max(200).optional(), referencia: z.string().max(300).optional() })
          .optional()
          .describe('A dónde llevarlo'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ clave, ...datos }) => {
      const r = await sincronizar.aplicarUna(
        { clave, tipo: 'pedido.crear', datos, creadaEn: new Date().toISOString() },
        sesion.token,
        { origen: 'mcp', tiendaId: sesion.tiendaId },
      );
      if (r.estado === 'aplicada' || r.estado === 'repetida') return texto({ estado: r.estado, pedido: r.respuesta });
      return falla(r.error ?? `El pedido quedó ${r.estado}`);
    },
  );

  servidor.registerTool(
    'ver_pedido',
    {
      title: 'Ver un pedido',
      description: 'Estado, total, líneas y QR de un pedido de esta tienda, por su id.',
      inputSchema: { id: z.string().min(1).max(100) },
      annotations: lectura,
    },
    async ({ id }) => {
      try {
        const pedido = await consultas.pedido(sesion.token, id);
        return pedido ? texto(pedido) : falla('Ese pedido no existe o no es de esta tienda');
      } catch (e) {
        return falla((e as Error).message);
      }
    },
  );

  servidor.registerTool(
    'mis_pedidos',
    {
      title: 'Mis pedidos',
      description: 'Los pedidos que hizo esta tienda.',
      inputSchema: {},
      annotations: lectura,
    },
    async () => leyendo(() => consultas.misCompras(sesion.token)),
  );

  return servidor;
}

