import { claveDe, COLECCIONES, EDITABLES, datosVacios, type CambiosDeNegocio, type Coleccion, type DatosDeNegocio } from '@abasto/comercio';
import * as SQLite from 'expo-sqlite';
import { normalizar, type AlmacenLocal } from './almacen-local';

/**
 * «Mi negocio» en el teléfono (SQLite). No es la fuente de la verdad: la base de datos es el esquema `negocio` de
 * Cobros. Aquí queda una copia para andar sin señal y la cola de lo que falta subir (docs/plan-mi-negocio.md,
 * «Cómo se sincroniza»). Cada fila lleva su dueño (el usuario de la sesión): dos personas en el mismo celular no se
 * mezclan.
 *
 * - `registro`: una fila por registro de cualquier colección, con la misma regla que `fusionar` (lo que solo se agrega
 *   entra una vez; lo editable gana si es igual o más nuevo).
 * - `pendiente`: lo hecho en el teléfono que el servidor todavía no confirmó.
 * - `marca`: hasta dónde se bajó del servidor (la marca la pone el servidor, no el reloj del teléfono).
 */
let base: SQLite.SQLiteDatabase | null = null;

function abrir() {
  if (base) return base;
  base = SQLite.openDatabaseSync('abasto.db');
  base.execSync(`
    CREATE TABLE IF NOT EXISTS registro (
      dueno TEXT NOT NULL, coleccion TEXT NOT NULL, clave TEXT NOT NULL, actualizado_en TEXT, datos TEXT NOT NULL,
      PRIMARY KEY (dueno, coleccion, clave)
    );
    CREATE TABLE IF NOT EXISTS pendiente (
      dueno TEXT NOT NULL, coleccion TEXT NOT NULL, clave TEXT NOT NULL, datos TEXT NOT NULL,
      PRIMARY KEY (dueno, coleccion, clave)
    );
    CREATE TABLE IF NOT EXISTS marca (dueno TEXT PRIMARY KEY NOT NULL, hasta TEXT NOT NULL);
  `);
  migrarFase2(base);
  return base;
}

/** La Fase 2 guardaba artículos y movimientos en tablas propias: pasan a `registro` y a la cola, una sola vez */
function migrarFase2(db: SQLite.SQLiteDatabase) {
  const vieja = db.getFirstSync<{ n: number }>("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'articulo'");
  if (!vieja?.n) return;
  db.withTransactionSync(() => {
    for (const f of db.getAllSync<{ dueno: string; datos: string }>('SELECT dueno, datos FROM articulo')) {
      const a = normalizar('articulos', JSON.parse(f.datos)) as { id: string; actualizadoEn: string };
      escribirSync(db, f.dueno, 'articulos', a, true);
    }
    for (const f of db.getAllSync<{ dueno: string; datos: string }>('SELECT dueno, datos FROM movimiento')) {
      escribirSync(db, f.dueno, 'movimientos', JSON.parse(f.datos), true);
    }
    db.execSync('DROP TABLE articulo; DROP TABLE movimiento;');
  });
}

function escribirSync(db: SQLite.SQLiteDatabase, dueno: string, c: Coleccion, r: { id: string; claveUnica?: string; actualizadoEn?: string }, pendiente: boolean) {
  const clave = claveDe(c, r);
  const datos = JSON.stringify(r);
  if (EDITABLES.has(c)) {
    db.runSync(
      `INSERT INTO registro (dueno, coleccion, clave, actualizado_en, datos) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (dueno, coleccion, clave) DO UPDATE SET actualizado_en = excluded.actualizado_en, datos = excluded.datos
       WHERE excluded.actualizado_en >= registro.actualizado_en`,
      dueno, c, clave, r.actualizadoEn ?? '', datos,
    );
  } else {
    db.runSync('INSERT OR IGNORE INTO registro (dueno, coleccion, clave, actualizado_en, datos) VALUES (?, ?, ?, NULL, ?)', dueno, c, clave, datos);
  }
  if (pendiente) db.runSync('INSERT OR REPLACE INTO pendiente (dueno, coleccion, clave, datos) VALUES (?, ?, ?, ?)', dueno, c, clave, datos);
}

class AlmacenDeNegocioSQLite implements AlmacenLocal {
  constructor(private readonly dueno: string) {}

  async leer(): Promise<DatosDeNegocio> {
    const datos = datosVacios();
    const filas = await abrir().getAllAsync<{ coleccion: Coleccion; datos: string }>('SELECT coleccion, datos FROM registro WHERE dueno = ?', this.dueno);
    for (const f of filas) if (COLECCIONES.includes(f.coleccion)) (datos[f.coleccion] as unknown[]).push(normalizar(f.coleccion, JSON.parse(f.datos)));
    return datos;
  }

  /** Lo hecho en el teléfono: se guarda y queda en la cola para subir */
  async guardar(cambios: CambiosDeNegocio) {
    await this.escribir(cambios, true);
  }

  /** Lo que baja del servidor: se guarda sin volver a la cola */
  async aplicarDelServidor(cambios: CambiosDeNegocio) {
    await this.escribir(cambios, false);
  }

  private async escribir(cambios: CambiosDeNegocio, pendiente: boolean) {
    const db = abrir();
    await db.withTransactionAsync(async () => {
      for (const c of COLECCIONES) for (const r of cambios[c] ?? []) escribirSync(db, this.dueno, c, r as { id: string }, pendiente);
    });
  }

  async pendientes(): Promise<CambiosDeNegocio> {
    const cambios: CambiosDeNegocio = {};
    const filas = await abrir().getAllAsync<{ coleccion: Coleccion; datos: string }>('SELECT coleccion, datos FROM pendiente WHERE dueno = ?', this.dueno);
    for (const f of filas) (cambios[f.coleccion] ??= [] as never[]).push(JSON.parse(f.datos) as never);
    return cambios;
  }

  /** Lo que el servidor ya confirmó sale de la cola (si se cambió de nuevo mientras subía, queda la versión nueva) */
  async quitarPendientes(subidos: CambiosDeNegocio) {
    const db = abrir();
    await db.withTransactionAsync(async () => {
      for (const c of COLECCIONES) {
        for (const r of subidos[c] ?? []) {
          await db.runAsync('DELETE FROM pendiente WHERE dueno = ? AND coleccion = ? AND clave = ? AND datos = ?', this.dueno, c, claveDe(c, r as { id: string }), JSON.stringify(r));
        }
      }
    });
  }

  async marca() {
    return (await abrir().getFirstAsync<{ hasta: string }>('SELECT hasta FROM marca WHERE dueno = ?', this.dueno))?.hasta ?? null;
  }

  async guardarMarca(hasta: string) {
    await abrir().runAsync('INSERT OR REPLACE INTO marca (dueno, hasta) VALUES (?, ?)', this.dueno, hasta);
  }
}

export const almacenDeNegocio = (dueno: string): AlmacenLocal => new AlmacenDeNegocioSQLite(dueno);
