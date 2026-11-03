import type { CuentaPorCobrar } from './cuenta-por-cobrar.js';
import type { LineaDeCredito } from './linea-de-credito.js';

/** Puerto: dónde viven las cuentas por cobrar (CU-09). */
export interface CuentaPorCobrarRepositorio {
  porPedido(pedidoId: string): Promise<CuentaPorCobrar | null>;
  /** Todas las de un mayorista; las pagadas solo si se piden. */
  delMayorista(mayoristaId: string, conPagadas: boolean): Promise<CuentaPorCobrar[]>;
  /**
   * Guarda la cuenta, sus pagos nuevos y sus eventos (outbox) en una sola transacción. Si el pago la dejó saldada y
   * era a crédito, guarda también la línea con el cupo devuelto: o pasan las dos cosas o ninguna.
   */
  guardar(cuenta: CuentaPorCobrar, lineaSaldada?: LineaDeCredito): Promise<void>;
}

export const CUENTA_POR_COBRAR_REPOSITORIO = Symbol('CuentaPorCobrarRepositorio');
