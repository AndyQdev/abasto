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
    await dueno.query(`INSERT INTO pedidos VALUES
      ('lp', 'P-SEG-1', 'A-1', 'dr', 'Tienda Doña Rosa', 'qr', 100, 'CONFIRMADO', NULL, now(), now()),
      ('lr', 'P-SEG-2', 'R-1', 'lp', 'Distribuidora Los Pozos', 'credito', 100, 'RECHAZADO', 'Sin stock', now(), now())
      ON CONFLICT DO NOTHING`);
  });

  afterAll(async () => {
    await dueno.query("DELETE FROM cuentas_por_cobrar WHERE pedido_id LIKE 'P-SEG-%'");
    await dueno.query("DELETE FROM pedidos WHERE pedido_id LIKE 'P-SEG-%'");
    await dueno.end();
    await lector.end();
  });

  it('solo ve las filas de su empresa', async () => {
    const r = await consultor.consultar("SELECT org_id FROM cuentas_por_cobrar WHERE pedido_id LIKE 'P-SEG-%'", lp);
    expect(r.filas.map((f) => f.org_id)).toEqual(['lp']);
  });

  it('tampoco ve los pedidos de otra empresa (tabla nueva del proyector)', async () => {
    const r = await consultor.consultar("SELECT org_id, codigo FROM pedidos WHERE pedido_id LIKE 'P-SEG-%'", lp);
    expect(r.filas).toEqual([{ org_id: 'lp', codigo: 'A-1' }]);
  });

  it('no puede leer el inbox del proyector aunque la guardia fallara', async () => {
    await expect(consultor.consultar('SELECT * FROM eventos_proyectados', lp)).rejects.toThrow(/permission|permiso/i);
  });

  it('no puede cambiar la empresa de la sesión desde la consulta: la base le niega set_config', async () => {
    await expect(
      consultor.consultar(
        "SELECT org_id FROM pedidos WHERE set_config('abasto.org_id', 'lr', true) IS NOT NULL AND pedido_id LIKE 'P-SEG-%'",
        lp,
      ),
    ).rejects.toThrow(/permission denied for function set_config/);
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
