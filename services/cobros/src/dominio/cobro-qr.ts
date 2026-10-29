import { Dinero } from './dinero.js';
import { MontoInvalido, QrNoSePuedePagar } from './errores.js';
import type { EventoDeCobros } from './eventos.js';

export type EstadoCobroQr = 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'DEVUELTO' | 'ANULADO';

export interface DatosCobroQr {
  id: string;
  pedidoId: string;
  tiendaId: string;
  mayoristaId: string;
  monto: Dinero;
  estado: EstadoCobroQr;
  /** Lo que lleva el QR. En la demo es un texto simulado; con un banco real, el payload que devuelve el banco. */
  codigo: string;
  creadoEn: Date;
  venceEn: Date;
  pagadoEn: Date | null;
}

export interface GenerarCobroQr {
  id: string;
  pedidoId: string;
  tiendaId: string;
  mayoristaId: string;
  monto: Dinero;
  ahora: Date;
  vigenciaMinutos: number;
}

/**
 * Agregado: el cobro por QR de un pedido (paso 3 de la saga cuando la tienda paga por QR).
 * Hay un solo QR por pedido. Pagar, vencer y devolver son idempotentes porque la saga puede repetir mensajes.
 */
export class CobroQr {
  private eventos: EventoDeCobros[] = [];

  constructor(private datos: DatosCobroQr) {}

  static generar(g: GenerarCobroQr): CobroQr {
    if (!g.monto.esPositivo()) throw new MontoInvalido('El monto del QR tiene que ser mayor a cero');
    return new CobroQr({
      id: g.id,
      pedidoId: g.pedidoId,
      tiendaId: g.tiendaId,
      mayoristaId: g.mayoristaId,
      monto: g.monto,
      estado: 'PENDIENTE',
      codigo: `ABASTO-QR|${g.pedidoId}|${g.monto.centavos}|${g.id}`,
      creadoEn: g.ahora,
      venceEn: new Date(g.ahora.getTime() + g.vigenciaMinutos * 60_000),
      pagadoEn: null,
    });
  }

  get id() {
    return this.datos.id;
  }
  get pedidoId() {
    return this.datos.pedidoId;
  }
  get tiendaId() {
    return this.datos.tiendaId;
  }
  get mayoristaId() {
    return this.datos.mayoristaId;
  }
  get monto() {
    return this.datos.monto;
  }
  get estado() {
    return this.datos.estado;
  }
  get codigo() {
    return this.datos.codigo;
  }
  get creadoEn() {
    return this.datos.creadoEn;
  }
  get venceEn() {
    return this.datos.venceEn;
  }
  get pagadoEn() {
    return this.datos.pagadoEn;
  }

  /** La tienda pagó. Si ya estaba pagado, no hace nada. */
  pagar(ahora: Date): void {
    if (this.datos.estado === 'PAGADO') return;
    if (this.datos.estado !== 'PENDIENTE') {
      throw new QrNoSePuedePagar(`Este QR ya no se puede pagar: está ${this.datos.estado.toLowerCase()}`);
    }
    if (ahora.getTime() > this.datos.venceEn.getTime()) {
      throw new QrNoSePuedePagar('Este QR venció. Vuelve a hacer el pedido');
    }
    this.datos = { ...this.datos, estado: 'PAGADO', pagadoEn: ahora };
    this.eventos.push({ tipo: 'cobro.qr_pagado', ...this.referencia(), centavos: this.datos.monto.centavos });
  }

  /** Nadie queda colgado: un QR sin pagar vence y la saga deshace la reserva. */
  vencerSiCorresponde(ahora: Date): boolean {
    if (this.datos.estado !== 'PENDIENTE' || ahora.getTime() <= this.datos.venceEn.getTime()) return false;
    this.datos = { ...this.datos, estado: 'VENCIDO' };
    this.eventos.push({ tipo: 'cobro.rechazado', ...this.referencia(), motivo: 'El QR venció sin que se pagara' });
    return true;
  }

  /** Compensación de la saga: devuelve lo pagado (asiento inverso) o anula el QR que no se pagó. */
  devolver(): void {
    if (this.datos.estado === 'PAGADO') {
      this.datos = { ...this.datos, estado: 'DEVUELTO' };
    } else if (this.datos.estado === 'PENDIENTE') {
      this.datos = { ...this.datos, estado: 'ANULADO' };
    } else {
      return;
    }
    this.eventos.push({ tipo: 'cobro.qr_devuelto', ...this.referencia(), centavos: this.datos.monto.centavos });
  }

  sacarEventos(): EventoDeCobros[] {
    const pendientes = this.eventos;
    this.eventos = [];
    return pendientes;
  }

  private referencia() {
    return { pedidoId: this.datos.pedidoId, tiendaId: this.datos.tiendaId, mayoristaId: this.datos.mayoristaId };
  }
}
