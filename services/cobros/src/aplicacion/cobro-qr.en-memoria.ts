import type { CobroQr } from '../dominio/cobro-qr.js';
import type { CobroQrRepositorio, MensajesProcesados, Outbox } from '../dominio/cobro-qr.repositorio.js';
import type { EventoDeCobros } from '../dominio/eventos.js';

/** Adaptadores en memoria para las pruebas de los casos de uso. No se usan en producción. */
export class CobroQrEnMemoria implements CobroQrRepositorio {
  private readonly cobros = new Map<string, CobroQr>();

  constructor(readonly outbox: EventoDeCobros[] = []) {}

  async porPedido(pedidoId: string) {
    return this.cobros.get(pedidoId) ?? null;
  }

  async pendientesVencidos(ahora: Date) {
    return [...this.cobros.values()].filter((c) => c.estado === 'PENDIENTE' && c.venceEn.getTime() < ahora.getTime());
  }

  async guardar(cobro: CobroQr) {
    this.outbox.push(...cobro.sacarEventos());
    this.cobros.set(cobro.pedidoId, cobro);
  }
}

export class OutboxEnMemoria implements Outbox {
  constructor(readonly eventos: EventoDeCobros[] = []) {}

  async agregar(evento: EventoDeCobros) {
    this.eventos.push(evento);
  }
}

export class ProcesadosEnMemoria implements MensajesProcesados {
  private readonly ids = new Set<string>();

  async yaProcesado(id: string) {
    return this.ids.has(id);
  }

  async marcar(id: string) {
    this.ids.add(id);
  }
}
