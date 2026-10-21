import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { describirEsquema } from '../reportes/dominio/esquema.js';
import { ConsultaRechazada, type ConsultarReportes } from '../reportes/aplicacion/consultar-reportes.js';
import type { Solicitante } from '../reportes/puertos.js';

/**
 * MCP interno de Abasto: deja que un modelo de lenguaje lea los reportes del mayorista y nada más.
 * Se crea uno por petición con el usuario del token, así cada consulta queda atada a su empresa.
 */
export function crearServidorMcp(reportes: ConsultarReportes, solicitante: Solicitante): McpServer {
  const servidor = new McpServer({ name: 'abasto-reportes', version: '1.0.0' });

  servidor.registerTool(
    'describir_reportes',
    {
      title: 'Describir las tablas de reportes',
      description: 'Lista las tablas y columnas que se pueden consultar con consultar_reportes.',
      inputSchema: {},
    },
    async () => ({ content: [{ type: 'text', text: describirEsquema() }] }),
  );

  servidor.registerTool(
    'consultar_reportes',
    {
      title: 'Consultar reportes (solo lectura)',
      description:
        'Ejecuta UNA consulta SELECT de PostgreSQL sobre las tablas de reportes del mayorista. ' +
        'Devuelve como máximo 1.000 filas. Cualquier otra sentencia se rechaza.',
      inputSchema: { sql: z.string().min(1).max(4000).describe('Una sola sentencia SELECT') },
    },
    async ({ sql }) => {
      try {
        const r = await reportes.ejecutar(sql, solicitante, 'mcp');
        return {
          content: [{ type: 'text', text: JSON.stringify({ columnas: r.columnas, filas: r.filas, truncado: r.truncado }) }],
        };
      } catch (e) {
        const motivo = e instanceof ConsultaRechazada ? e.motivo : 'La consulta falló';
        return { isError: true, content: [{ type: 'text', text: motivo }] };
      }
    },
  );

  return servidor;
}
