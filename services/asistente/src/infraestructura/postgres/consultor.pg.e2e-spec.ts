// Suite de seguridad del MCP contra PostgreSQL real. Necesita `pnpm infra` y la semilla de Asistente.
// Se corre con `pnpm --filter @abasto/asistente test:e2e`.
import { crearPoolDueno, crearPoolLector } from './conexiones.js';
import { ConsultorPostgres } from './consultor.pg.js';
import { migrar } from './migrador.js';

describe('ConsultorPostgres como mcp_lector', () => {
  const dueno = crearPoolDueno();
  const lector = crearPoolLector();
  const consultor = new ConsultorPostgres(lector);
  const lp = { usuarioId: 'u1', orgId: 'lp' };

  beforeAll(async () => {
    await migrar(dueno);
    await dueno.query(`INSERT INTO cuentas_por_cobrar VALUES
      ('lp', 'P-SEG-1', 'dr', 'Tienda Doña Rosa', 100, current_date, 'pendiente'),
      ('lr', 'P-SEG-2', 'lp', 'Distribuidora Los Pozos', 100, current_date, 'pendiente')
      ON CONFLICT DO NOTHING`);
  });

  afterAll(async () => {
    await dueno.query("DELETE FROM cuentas_por_cobrar WHERE pedido_id LIKE 'P-SEG-%'");
    await dueno.end();
    await lector.end();
  });

  it('solo ve las filas de su empresa', async () => {
    const r = await consultor.consultar("SELECT org_id FROM cuentas_por_cobrar WHERE pedido_id LIKE 'P-SEG-%'", lp);
    expect(r.filas.map((f) => f.org_id)).toEqual(['lp']);
  });

  it('corta en 1.000 filas', async () => {
    const r = await consultor.consultar('SELECT g FROM generate_series(1, 1001) AS g', lp);
    expect(r.filas).toHaveLength(1000);
    expect(r.truncado).toBe(true);
  });

  it('mcp_lector no puede escribir aunque alguien salte la guardia', async () => {
    await expect(
      lector.query("INSERT INTO cuentas_por_cobrar VALUES ('lp','X','x','x',1,current_date,'pendiente')"),
    ).rejects.toThrow();
  });

  it('una consulta que tarda más de 5 segundos se corta', async () => {
    await expect(consultor.consultar('SELECT count(*) FROM generate_series(1, 400000000)', lp)).rejects.toThrow(
      /timeout|cancel/i,
    );
  }, 15000);
});
