import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ConsultarReportes } from '../reportes/aplicacion/consultar-reportes.js';
import type { RegistroDeAuditoria, Solicitante } from '../reportes/puertos.js';
import { crearServidorMcp } from './servidor-mcp.js';

/** Un cliente MCP de verdad (como Claude Desktop) conectado en memoria al servidor de Abasto. */
async function conectar(solicitante: Solicitante) {
  const ejecutadas: { sql: string; orgId: string }[] = [];
  const auditoria: RegistroDeAuditoria[] = [];
  const reportes = new ConsultarReportes(
    {
      consultar: async (sql, s) => {
        ejecutadas.push({ sql, orgId: s.orgId });
        return { columnas: ['total'], filas: [{ total: 1 }], truncado: false };
      },
    },
    { registrar: async (r) => void auditoria.push(r) },
  );
  const [delCliente, delServidor] = InMemoryTransport.createLinkedPair();
  await crearServidorMcp(reportes, solicitante).connect(delServidor);
  const cliente = new Client({ name: 'prueba', version: '1.0.0' });
  await cliente.connect(delCliente);
  const consultar = (sql: string) =>
    cliente.callTool({ name: 'consultar_reportes', arguments: { sql } }) as Promise<{
      isError?: boolean;
      content: { type: string; text: string }[];
    }>;
  return { cliente, consultar, ejecutadas, auditoria };
}

const lp = { usuarioId: 'u1', orgId: 'lp' };

describe('Servidor MCP de reportes', () => {
  it('solo ofrece leer: describir las tablas y consultar', async () => {
    const { cliente } = await conectar(lp);
    const { tools } = await cliente.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['consultar_reportes', 'describir_reportes']);
  });

  it('una consulta permitida corre con la empresa del token y queda auditada como mcp', async () => {
    const { consultar, ejecutadas, auditoria } = await conectar(lp);
    const r = await consultar('SELECT sum(total_centavos) AS total FROM ventas_diarias');

    expect(r.isError).toBeFalsy();
    expect(JSON.parse(r.content[0].text).filas).toEqual([{ total: 1 }]);
    expect(ejecutadas[0].orgId).toBe('lp');
    expect(auditoria[0]).toMatchObject({ origen: 'mcp', resultado: 'ok', orgId: 'lp' });
  });

  it.each([
    ['borrar datos', 'DELETE FROM ventas_diarias'],
    ['cambiar datos', "UPDATE cuentas_por_cobrar SET estado = 'pagada'"],
    ['dos sentencias', 'SELECT 1 FROM ventas_diarias; DROP TABLE ventas_diarias'],
    ['tablas que no son de reportes', 'SELECT * FROM pg_user'],
    ['la base de pedidos', 'SELECT * FROM pedidos.pedido'],
    ['cambiar de empresa', "SELECT set_config('abasto.org_id', 'lr', true)"],
  ])('rechaza %s sin tocar la base y lo deja auditado', async (_caso, sql) => {
    const { consultar, ejecutadas, auditoria } = await conectar(lp);
    const r = await consultar(sql);

    expect(r.isError).toBe(true);
    expect(r.content[0].text).not.toBe('');
    expect(ejecutadas).toEqual([]);
    expect(auditoria[0]).toMatchObject({ origen: 'mcp', resultado: 'rechazada', orgId: 'lp' });
  });
});
