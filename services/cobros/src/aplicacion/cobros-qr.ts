import { CobroQr } from '../dominio/cobro-qr.js';
import type { CobroQrRepositorio } from '../dominio/cobro-qr.repositorio.js';
import { Dinero } from '../dominio/dinero.js';
import { CobroNoExiste, SinPermiso } from '../dominio/errores.js';

export interface Reloj {
  ahora(): Date;
}

export interface OpcionesQr {
  vigenciaMinutos: number;
  generarId: () => string;
  reloj: Reloj;
}

export interface GenerarQrEntrada {
  pedidoId: string;
  tiendaId: string;
  mayoristaId: string;
  centavos: number;
}

/** Paso 3 de la saga cuando se paga por QR. Si el pedido ya tiene su QR, devuelve el mismo. */
export class GenerarQr {
  constructor(
    private readonly cobros: CobroQrRepositorio,
    private readonly opciones: OpcionesQr,
  ) {}

  /** `nuevo` es false si el pedido ya tenía su QR (un comando repetido): así el aviso sale una sola vez */
  async ejecutar(e: GenerarQrEntrada): Promise<{ cobro: CobroQr; nuevo: boolean }> {
    const existente = await this.cobros.porPedido(e.pedidoId);
    if (existente) return { cobro: existente, nuevo: false };
    const cobro = CobroQr.generar({
      id: this.opciones.generarId(),
      pedidoId: e.pedidoId,
      tiendaId: e.tiendaId,
      mayoristaId: e.mayoristaId,
      monto: Dinero.deCentavos(e.centavos),
      ahora: this.opciones.reloj.ahora(),
      vigenciaMinutos: this.opciones.vigenciaMinutos,
    });
    await this.cobros.guardar(cobro);
    return { cobro, nuevo: true };
  }
}

/**
 * La tienda pagó el QR. Con un banco real esto lo dispara el aviso del banco;
 * en la demo, la tienda toca «Simular pago» en Mercado.
 */
export class PagarQr {
  constructor(
    private readonly cobros: CobroQrRepositorio,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(pedidoId: string, orgId: string): Promise<CobroQr> {
    const cobro = await this.cobros.porPedido(pedidoId);
    if (!cobro) throw new CobroNoExiste(pedidoId);
    if (cobro.tiendaId !== orgId) throw new SinPermiso('Solo la tienda que compró puede pagar este QR');
    cobro.pagar(this.reloj.ahora());
    await this.cobros.guardar(cobro);
    return cobro;
  }
}

/** Compensación de la saga: devuelve lo pagado o anula el QR. */
export class DevolverQr {
  constructor(private readonly cobros: CobroQrRepositorio) {}

  async ejecutar(pedidoId: string): Promise<void> {
    const cobro = await this.cobros.porPedido(pedidoId);
    if (!cobro) return;
    cobro.devolver();
    await this.cobros.guardar(cobro);
  }
}

/** Corre cada pocos segundos: un QR sin pagar vence y la saga libera el stock. */
export class VencerQrs {
  constructor(
    private readonly cobros: CobroQrRepositorio,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(): Promise<number> {
    const ahora = this.reloj.ahora();
    let vencidos = 0;
    for (const cobro of await this.cobros.pendientesVencidos(ahora)) {
      if (cobro.vencerSiCorresponde(ahora)) {
        await this.cobros.guardar(cobro);
        vencidos++;
      }
    }
    return vencidos;
  }
}

/** El cobro de un pedido, solo para la tienda que compra o el mayorista que vende. */
export class ConsultarCobro {
  constructor(private readonly cobros: CobroQrRepositorio) {}

  async dePedido(pedidoId: string, orgId: string): Promise<CobroQr | null> {
    const cobro = await this.cobros.porPedido(pedidoId);
    if (!cobro || (cobro.tiendaId !== orgId && cobro.mayoristaId !== orgId)) return null;
    return cobro;
  }
}
