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
    ['SELECT fecha::text, total_centavos::numeric / 100 AS bs FROM ventas_diarias'],
    ['SELECT CAST(stock AS integer) FROM stock_productos'],
    ["SELECT estado, count(*) FROM pedidos WHERE creado_en >= current_date - interval '7 days' GROUP BY estado"],
    ['SELECT p.tienda_nombre, c.saldo_centavos FROM pedidos p JOIN cuentas_por_cobrar c ON c.pedido_id = p.codigo'],
    ['WITH deuda AS (SELECT tienda_nombre, sum(saldo_centavos) AS s FROM cuentas_por_cobrar GROUP BY 1) SELECT * FROM deuda'],
  ])('deja pasar consultas de reportes normales: %s', (sql) => {
    expect(validarConsulta(sql).ok).toBe(true);
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
    // Tablas que no son de reportes, aunque vengan escondidas
    ['SELECT * FROM eventos_proyectados'],
    ['SELECT * FROM public.eventos_proyectados'],
    ['SELECT * FROM "eventos_proyectados"'],
    ['SELECT * FROM ventas_diarias UNION SELECT * FROM eventos_proyectados'],
    ['SELECT (SELECT usename FROM pg_user LIMIT 1) FROM ventas_diarias'],
    ['SELECT * FROM ventas_diarias WHERE fecha IN (SELECT aplicada_en::date FROM migraciones_aplicadas)'],
    ['SELECT * FROM pg_catalog.pg_user'],
    ['TABLE eventos_proyectados'],
    ['WITH eventos_proyectados AS (SELECT 1) SELECT * FROM public.eventos_proyectados'],
    ['WITH x AS (SELECT * FROM eventos_proyectados) SELECT * FROM x'],
    // Funciones de administración o de otra base, también calificadas o dentro del FROM
    ['SELECT pg_catalog.pg_sleep(10)'],
    ['SELECT * FROM ventas_diarias, LATERAL pg_sleep(10)'],
    ['SELECT * FROM ventas_diarias WHERE pg_sleep(10) IS NULL'],
    ["SELECT current_setting('abasto.org_id')"],
    ["SELECT * FROM dblink('host=otra', 'select 1') AS t(a int)"],
    ["SELECT query_to_xml('select * from eventos_proyectados', true, true, '')"],
    ["SELECT lo_import('/etc/passwd')"],
    ['SELECT * FROM generate_series(1, 100000000)'],
    // Conversiones a tipos del sistema: revelan qué existe en la base
    ["SELECT 'eventos_proyectados'::regclass"],
    ["SELECT CAST('pg_sleep' AS regproc)"],
    ["SELECT 'ventas_diarias'::regclass::oid"],
    // Otras sentencias
    ['EXPLAIN ANALYZE SELECT * FROM ventas_diarias'],
    ["COPY ventas_diarias TO '/tmp/x'"],
    ['SELECT 1 /* ; */'],
  ])('rechaza: %s', (sql) => rechaza(sql));
});
