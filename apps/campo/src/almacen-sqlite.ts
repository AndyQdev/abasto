import * as SQLite from 'expo-sqlite';
import type { Almacen, OperacionLocal } from './bandeja';

/** La bandeja en SQLite: sobrevive a cerrar la app y a reiniciar el teléfono. */
export class AlmacenSQLite implements Almacen {
  private readonly db = SQLite.openDatabaseSync('abasto-campo.db');

  constructor() {
    this.db.execSync(`CREATE TABLE IF NOT EXISTS bandeja (
      clave TEXT PRIMARY KEY NOT NULL,
      datos TEXT NOT NULL,
      creada_en TEXT NOT NULL,
      estado TEXT NOT NULL,
      intentos INTEGER NOT NULL,
      error TEXT
    )`);
  }

  async guardar(op: OperacionLocal) {
    await this.db.runAsync(
      `INSERT INTO bandeja (clave, datos, creada_en, estado, intentos, error) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(clave) DO UPDATE SET estado = excluded.estado, intentos = excluded.intentos, error = excluded.error`,
      op.clave,
      JSON.stringify(op.datos),
      op.creadaEn,
      op.estado,
      op.intentos,
      op.error ?? null,
    );
  }

  async todas(): Promise<OperacionLocal[]> {
    const filas = await this.db.getAllAsync<{
      clave: string;
      datos: string;
      creada_en: string;
      estado: OperacionLocal['estado'];
      intentos: number;
      error: string | null;
    }>('SELECT * FROM bandeja ORDER BY creada_en');
    return filas.map((f) => ({
      clave: f.clave,
      datos: JSON.parse(f.datos),
      creadaEn: f.creada_en,
      estado: f.estado,
      intentos: f.intentos,
      error: f.error ?? undefined,
    }));
  }
}
