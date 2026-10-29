import type { CobroQr } from './cobro-qr.js';
import type { EventoDeCobros } from './eventos.js';

/** Puerto: dónde viven los cobros por QR. */
export interface CobroQrRepositorio {
  porPedido(pedidoId: string): Promise<CobroQr | null>;
  /** Los que siguen pendientes con el plazo vencido, para que la saga no quede colgada. */
  pendientesVencidos(ahora: Date): Promise<CobroQr[]>;
  /** Guarda el cobro y sus eventos nuevos en la misma transacción (outbox). */
  guardar(cobro: CobroQr): Promise<void>;
}

/** Puerto: un evento que no sale de un agregado (por ejemplo, un cobro rechazado) va directo al outbox. */
export interface Outbox {
  agregar(evento: EventoDeCobros): Promise<void>;
}

/** Puerto: los comandos de la saga que ya se atendieron. Un mensaje repetido no se aplica dos veces. */
export interface MensajesProcesados {
  yaProcesado(id: string): Promise<boolean>;
  marcar(id: string): Promise<void>;
}

export const COBRO_QR_REPOSITORIO = Symbol('CobroQrRepositorio');
export const OUTBOX = Symbol('Outbox');
export const MENSAJES_PROCESADOS = Symbol('MensajesProcesados');
