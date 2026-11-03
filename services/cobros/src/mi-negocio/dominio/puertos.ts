import type { DatosDeProducto } from './compra-entregada.js';
import type { CambiosDeNegocio, DatosDeNegocio } from './modelo.js';

/** Dónde se guarda «Mi negocio» de cada cliente (el esquema negocio de Postgres) */
export interface RepositorioDeNegocio {
  /**
   * Guarda con la regla de la sincronización, todo en una transacción: lo que solo se agrega entra una vez; lo
   * editable se reemplaza si `actualizadoEn` es igual o más nuevo. Devuelve cuántos registros se escribieron.
   * Con `soloSiNoExisten`, lo editable tampoco se reemplaza (lo que llega del servidor no pisa al cliente).
   */
  guardar(orgId: string, cambios: CambiosDeNegocio, opciones?: { soloSiNoExisten?: boolean }): Promise<number>;
  /** Todo lo del cliente recibido después de `desde` (null: todo) */
  desde(orgId: string, desde: Date | null): Promise<DatosDeNegocio>;
}

export const REPOSITORIO_DE_NEGOCIO = Symbol('RepositorioDeNegocio');

/** Nombre y rubro de los productos del catálogo (los tiene Catálogo) */
export interface DirectorioDeProductos {
  datos(productoIds: string[]): Promise<Map<string, DatosDeProducto>>;
}

export const DIRECTORIO_DE_PRODUCTOS = Symbol('DirectorioDeProductos');

export interface Reloj {
  ahora(): Date;
}
