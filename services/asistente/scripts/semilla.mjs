// Prepara la base `reportes` para trabajar sin el resto del sistema:
// aplica las migraciones pendientes y carga los datos de demostración.
// `pnpm --filter @abasto/asistente semilla`
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

const cliente = new pg.Client({
  // 127.0.0.1 y no localhost: en Windows, localhost a veces cae en ::1 (wslrelay) y la conexión se corta
  host: process.env.REPORTES_HOST ?? '127.0.0.1',
  port: Number(process.env.REPORTES_PUERTO ?? 5440),
  database: 'reportes',
  user: process.env.REPORTES_USUARIO ?? 'reportes',
  password: process.env.REPORTES_CLAVE ?? 'reportes',
});
await cliente.connect();
await cliente.query(`CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
  nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())`);
const { rows } = await cliente.query('SELECT nombre FROM migraciones_aplicadas');
const aplicadas = new Set(rows.map((r) => r.nombre));
for (const archivo of (await readdir('migraciones')).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort()) {
  if (aplicadas.has(archivo)) continue;
  await cliente.query('BEGIN');
  await cliente.query(await readFile(`migraciones/${archivo}`, 'utf8'));
  await cliente.query('INSERT INTO migraciones_aplicadas (nombre) VALUES ($1)', [archivo]);
  await cliente.query('COMMIT');
  console.log(`reportes: migración ${archivo} aplicada`);
}
await cliente.query(await readFile('migraciones/semilla-demo.sql', 'utf8'));
await cliente.end();
console.log('reportes: datos de demostración listos');
