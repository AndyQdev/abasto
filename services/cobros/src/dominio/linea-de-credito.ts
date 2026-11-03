import { Dinero } from './dinero.js';
import { LimiteDeCreditoExcedido, MontoInvalido } from './errores.js';
import type { EventoDeCobros } from './eventos.js';

export type PlazoDias = 15 | 30;

export interface DatosLineaDeCredito {
  id: string;
  tiendaId: string;
  mayoristaId: string;
  limite: Dinero;
  plazoDias: PlazoDias;
  /** Lo reservado por cada pedido que todavía no se pagó: pedidoId → monto. */
  reservas: Map<string, Dinero>;
}

/**
 * Agregado: el crédito que un mayorista le da a una tienda.
 * Regla principal: la suma de lo reservado nunca pasa el límite.
 * autorizar y liberar son idempotentes porque la saga puede repetir un mensaje.
 */
export class LineaDeCredito {
  private readonly reservas: Map<string, Dinero>;
  private eventos: EventoDeCobros[] = [];

  constructor(private readonly datos: DatosLineaDeCredito) {
    this.reservas = new Map(datos.reservas);
  }

  get id(): string {
    return this.datos.id;
  }
  get tiendaId(): string {
    return this.datos.tiendaId;
  }
  get mayoristaId(): string {
    return this.datos.mayoristaId;
  }
  get limite(): Dinero {
    return this.datos.limite;
  }
  get plazoDias(): PlazoDias {
    return this.datos.plazoDias;
  }

  get usado(): Dinero {
    let total = Dinero.cero();
    for (const monto of this.reservas.values()) total = total.sumar(monto);
    return total;
  }

  get disponible(): Dinero {
    return this.limite.restar(this.usado);
  }

  reservaDe(pedidoId: string): Dinero | undefined {
    return this.reservas.get(pedidoId);
  }

  listaDeReservas(): Array<{ pedidoId: string; monto: Dinero }> {
    return [...this.reservas].map(([pedidoId, monto]) => ({ pedidoId, monto }));
  }

  autorizar(pedidoId: string, monto: Dinero): void {
    if (!monto.esPositivo()) {
      throw new MontoInvalido('El monto a autorizar tiene que ser mayor a cero');
    }
    const existente = this.reservas.get(pedidoId);
    if (existente) {
      if (existente.igualA(monto)) return; // mensaje repetido: ya estaba autorizado
      throw new MontoInvalido(`El pedido ${pedidoId} ya tiene autorizado ${existente.texto()}`);
    }
    if (monto.esMayorQue(this.disponible)) {
      throw new LimiteDeCreditoExcedido(this.disponible.texto(), monto.texto());
    }
    this.reservas.set(pedidoId, monto);
    this.eventos.push({
      tipo: 'cobro.credito_autorizado',
      pedidoId,
      tiendaId: this.tiendaId,
      mayoristaId: this.mayoristaId,
      centavos: monto.centavos,
    });
  }

  /** Compensación de la saga: devuelve el cupo. Si ya se devolvió, no hace nada. */
  liberar(pedidoId: string): void {
    const monto = this.reservas.get(pedidoId);
    if (!monto) return;
    this.reservas.delete(pedidoId);
    this.eventos.push({
      tipo: 'cobro.credito_liberado',
      pedidoId,
      tiendaId: this.tiendaId,
      mayoristaId: this.mayoristaId,
      centavos: monto.centavos,
    });
  }

  /**
   * CU-09: la tienda terminó de pagar el pedido y el cupo vuelve a estar disponible.
   * No publica cobro.credito_liberado: ese evento es una compensación de la saga y Pedidos lo tomaría como tal.
   */
  saldar(pedidoId: string): void {
    this.reservas.delete(pedidoId);
  }

  /** Entrega los eventos nuevos una sola vez, para guardarlos en el outbox. */
  sacarEventos(): EventoDeCobros[] {
    const pendientes = this.eventos;
    this.eventos = [];
    return pendientes;
  }
}
