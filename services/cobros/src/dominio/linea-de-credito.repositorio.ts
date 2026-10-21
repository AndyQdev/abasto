import type { LineaDeCredito } from './linea-de-credito.js';

/** Puerto: el dominio pide guardar y buscar; cómo se hace lo decide infraestructura. */
export interface LineaDeCreditoRepositorio {
  buscar(tiendaId: string, mayoristaId: string): Promise<LineaDeCredito | null>;
  buscarPorId(id: string): Promise<LineaDeCredito | null>;
  /** Guarda la línea y sus eventos nuevos en la misma transacción (outbox). */
  guardar(linea: LineaDeCredito): Promise<void>;
}

export const LINEA_DE_CREDITO_REPOSITORIO = Symbol('LineaDeCreditoRepositorio');
