import type { CuentaPorCobrar } from '../dominio/cuenta-por-cobrar.js';
import type { CuentaPorCobrarRepositorio } from '../dominio/cuenta-por-cobrar.repositorio.js';
import type { EventoDeCobros } from '../dominio/eventos.js';
import type { LineaDeCredito } from '../dominio/linea-de-credito.js';
import type { LineaDeCreditoRepositorio } from '../dominio/linea-de-credito.repositorio.js';

/** Adaptador en memoria para las pruebas de los casos de uso de CU-09. No se usa en producción. */
export class CuentasEnMemoria implements CuentaPorCobrarRepositorio {
  readonly cuentas = new Map<string, CuentaPorCobrar>();

  constructor(
    private readonly lineas: LineaDeCreditoRepositorio,
    readonly outbox: EventoDeCobros[] = [],
  ) {}

  async porPedido(pedidoId: string) {
    return this.cuentas.get(pedidoId) ?? null;
  }

  async delMayorista(mayoristaId: string, conPagadas: boolean) {
    return [...this.cuentas.values()].filter((c) => c.mayoristaId === mayoristaId && (conPagadas || c.estado !== 'PAGADA'));
  }

  async guardar(cuenta: CuentaPorCobrar, lineaSaldada?: LineaDeCredito) {
    this.outbox.push(...cuenta.sacarEventos());
    this.cuentas.set(cuenta.pedidoId, cuenta);
    if (lineaSaldada) await this.lineas.guardar(lineaSaldada);
  }
}
