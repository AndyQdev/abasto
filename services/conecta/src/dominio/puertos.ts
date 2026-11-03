import type { EntradaDeBitacora } from './bitacora.js';
import type { Operacion } from './operacion.js';

export type Reserva =
  | { tipo: 'nueva' }
  | { tipo: 'repetida'; respuesta: unknown }
  | { tipo: 'en_curso' }
  | { tipo: 'conflicto' };

/**
 * Puerto: registro de claves de idempotencia.
 * reservar() tiene que ser atómico: de 20 peticiones simultáneas con la misma clave, una sola recibe 'nueva'.
 */
export interface RegistroDeIdempotencia {
  reservar(clave: string, huella: string): Promise<Reserva>;
  completar(clave: string, respuesta: unknown): Promise<void>;
  /** Si el servicio de destino falló, se libera la clave para que el reintento pueda aplicarse. */
  liberar(clave: string): Promise<void>;
}

/** Puerto: a dónde va cada operación (Pedidos, Catálogo). */
export interface DestinoDeOperaciones {
  aplicar(operacion: Operacion, token: string): Promise<unknown>;
}

/** Puerto: la bitácora de lo que entró para cada mayorista (Panel › Conecta). */
export interface Bitacora {
  anotar(entrada: EntradaDeBitacora): Promise<void>;
  /** Lo último primero. */
  delMayorista(mayoristaId: string, limite: number): Promise<EntradaDeBitacora[]>;
}

export const REGISTRO_DE_IDEMPOTENCIA = Symbol('RegistroDeIdempotencia');
export const BITACORA = Symbol('Bitacora');
export const DESTINO_DE_OPERACIONES = Symbol('DestinoDeOperaciones');
