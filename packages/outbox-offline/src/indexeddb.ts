import Dexie, { type Table } from 'dexie';
import type { Almacen, OperacionLocal } from './bandeja.js';

/** La bandeja en IndexedDB: sobrevive a cerrar la pestaña y a reiniciar el teléfono. */
class BaseDeLaBandeja extends Dexie {
  operaciones!: Table<OperacionLocal, string>;

  constructor(nombre: string) {
    super(nombre);
    this.version(1).stores({ operaciones: 'clave, estado, creadaEn' });
  }
}

export class AlmacenIndexedDB implements Almacen {
  private readonly db: BaseDeLaBandeja;

  constructor(nombre = 'abasto-bandeja') {
    this.db = new BaseDeLaBandeja(nombre);
  }

  async guardar(operacion: OperacionLocal) {
    await this.db.operaciones.put(operacion);
  }

  async todas() {
    return this.db.operaciones.toArray();
  }
}
