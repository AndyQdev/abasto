import { validarConsulta } from './guardia-sql.js';

const rechaza = (sql: string) => {
  const r = validarConsulta(sql);
  expect(r.ok, `debió rechazar: ${sql}`).toBe(false);
};

describe('Guardia de SQL del MCP', () => {
  it('deja pasar una consulta de reportes', () => {
    const r = validarConsulta(
      `SELECT tienda_nombre, sum(saldo_centavos) AS deuda
         FROM cuentas_por_cobrar
        WHERE vence = current_date + 1
        GROUP BY tienda_nombre
        ORDER BY deuda DESC;`,
    );
    expect(r).toEqual({ ok: true, sql: expect.stringContaining('FROM cuentas_por_cobrar') });
  });

  it('permite agrupar por mes', () => {
    expect(validarConsulta("SELECT date_trunc('month', fecha), sum(total_centavos) FROM ventas_diarias GROUP BY 1").ok).toBe(true);
  });

  it.each([
    ["INSERT INTO ventas_diarias VALUES ('lp', now(), 1, 1)"],
    ['UPDATE cuentas_por_cobrar SET saldo_centavos = 0'],
    ['DELETE FROM cuentas_por_cobrar'],
    ['DROP TABLE ventas_diarias'],
    ['TRUNCATE stock_productos'],
    ['SELECT 1; DROP TABLE ventas_diarias'],
    ['SELECT pg_sleep(10)'],
    ["SELECT * FROM ventas_diarias WHERE set_config('abasto.org_id', 'lr', true) IS NOT NULL"],
    ["SELECT pg_read_file('/etc/passwd')"],
    ['SELECT * FROM pg_shadow'],
    ['SELECT * FROM information_schema.tables'],
    ['SELECT * INTO copia FROM ventas_diarias'],
    ['SELECT * FROM ventas_diarias FOR UPDATE'],
    ['WITH borrado AS (DELETE FROM ventas_diarias RETURNING *) SELECT * FROM borrado'],
    [''],
  ])('rechaza: %s', (sql) => rechaza(sql));
});
