import pg from 'pg';

// Fechas como 'AAAA-MM-DD' (sin corrimiento de zona horaria) y montos como número.
// Los montos están en centavos: caben de sobra en un número de JavaScript.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));

const host = process.env.REPORTES_HOST ?? 'localhost';
const puerto = Number(process.env.REPORTES_PUERTO ?? 5440);

/** Dueño de la base `reportes`: migra y proyecta. Nunca se usa para las consultas del Analista ni del MCP. */
export const crearPoolDueno = () =>
  new pg.Pool({
    host,
    port: puerto,
    database: 'reportes',
    user: process.env.REPORTES_USUARIO ?? 'reportes',
    password: process.env.REPORTES_CLAVE ?? 'reportes',
    max: 5,
  });

/** mcp_lector: solo SELECT, solo lectura, 5 segundos y seguridad por fila. */
export const crearPoolLector = () =>
  new pg.Pool({
    host,
    port: puerto,
    database: 'reportes',
    user: process.env.MCP_LECTOR_USUARIO ?? 'mcp_lector',
    password: process.env.MCP_LECTOR_CLAVE ?? 'mcp_lector',
    max: 5,
  });

export const POOL_DUENO = Symbol('PoolDueno');
export const POOL_LECTOR = Symbol('PoolLector');
