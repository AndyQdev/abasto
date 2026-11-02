import type { AlmacenDeNegocio, Articulo, DatosDeNegocio, Movimiento } from '@abasto/comercio';
import * as SQLite from 'expo-sqlite';

/**
 * El inventario de «Mi negocio» en el teléfono (SQLite): anda sin señal y sobrevive a cerrar la app. Cada fila lleva
 * su dueño (el usuario de la sesión), así dos personas que entran en el mismo celular no mezclan inventarios.
 * La clave única del movimiento es también la de la tabla: una compra que se sincroniza dos veces entra una vez.
 * El respaldo en la nube es la Fase 5 de docs/plan-mi-negocio.md.
 */
let base: SQLite.SQLiteDatabase | null = null;

function abrir() {
  if (base) return base;
  base = SQLite.openDatabaseSync('abasto.db');
  base.execSync(`
    CREATE TABLE IF NOT EXISTS articulo (
      dueno TEXT NOT NULL,
      id TEXT NOT NULL,
      datos TEXT NOT NULL,
      PRIMARY KEY (dueno, id)
    );
    CREATE TABLE IF NOT EXISTS movimiento (
      dueno TEXT NOT NULL,
      clave_unica TEXT NOT NULL,
      articulo_id TEXT NOT NULL,
      fecha TEXT NOT NULL,
      datos TEXT NOT NULL,
      PRIMARY KEY (dueno, clave_unica)
    );
    CREATE INDEX IF NOT EXISTS movimiento_por_articulo ON movimiento (dueno, articulo_id);
  `);
  return base;
}

export class AlmacenDeNegocioSQLite implements AlmacenDeNegocio {
  constructor(private readonly dueno: string) {}

  async leer(): Promise<DatosDeNegocio> {
    const db = abrir();
    const articulos = await db.getAllAsync<{ datos: string }>('SELECT datos FROM articulo WHERE dueno = ?', this.dueno);
    const movimientos = await db.getAllAsync<{ datos: string }>('SELECT datos FROM movimiento WHERE dueno = ? ORDER BY fecha', this.dueno);
    return {
      articulos: articulos.map((f) => JSON.parse(f.datos) as Articulo),
      movimientos: movimientos.map((f) => JSON.parse(f.datos) as Movimiento),
    };
  }

  async guardar({ articulos = [], movimientos = [] }: { articulos?: Articulo[]; movimientos?: Movimiento[] }) {
    const db = abrir();
    await db.withTransactionAsync(async () => {
      for (const a of articulos) {
        await db.runAsync('INSERT INTO articulo (dueno, id, datos) VALUES (?, ?, ?) ON CONFLICT (dueno, id) DO UPDATE SET datos = excluded.datos', this.dueno, a.id, JSON.stringify(a));
      }
      for (const m of movimientos) {
        await db.runAsync(
          'INSERT OR IGNORE INTO movimiento (dueno, clave_unica, articulo_id, fecha, datos) VALUES (?, ?, ?, ?, ?)',
          this.dueno,
          m.claveUnica,
          m.articuloId,
          m.fecha,
          JSON.stringify(m),
        );
      }
    });
  }
}

export const almacenDeNegocio = (dueno: string): AlmacenDeNegocio => new AlmacenDeNegocioSQLite(dueno);
