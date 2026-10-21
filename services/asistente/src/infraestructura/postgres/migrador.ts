import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';

/**
 * Migraciones de la base `reportes`: archivos NNN_nombre.sql en services/asistente/migraciones,
 * aplicados en orden y una sola vez. Una migración que ya está en main no se edita: se escribe otra.
 */
export async function migrar(pool: pg.Pool, carpeta = join(process.cwd(), 'migraciones')): Promise<string[]> {
  const cliente = await pool.connect();
  try {
    await cliente.query(`CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
      nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())`);
    const { rows } = await cliente.query<{ nombre: string }>('SELECT nombre FROM migraciones_aplicadas');
    const aplicadas = new Set(rows.map((r) => r.nombre));
    const pendientes = (await readdir(carpeta)).filter((f) => /^\d{3}_.+\.sql$/.test(f) && !aplicadas.has(f)).sort();

    for (const archivo of pendientes) {
      const sql = await readFile(join(carpeta, archivo), 'utf8');
      await cliente.query('BEGIN');
      try {
        await cliente.query(sql);
        await cliente.query('INSERT INTO migraciones_aplicadas (nombre) VALUES ($1)', [archivo]);
        await cliente.query('COMMIT');
      } catch (e) {
        await cliente.query('ROLLBACK');
        throw new Error(`Falló la migración ${archivo}: ${(e as Error).message}`);
      }
    }
    return pendientes;
  } finally {
    cliente.release();
  }
}
