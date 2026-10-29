import { CobroQr } from './cobro-qr.js';
import { Dinero } from './dinero.js';
import { MontoInvalido, QrNoSePuedePagar } from './errores.js';

const las10 = new Date('2026-10-28T14:00:00Z');
const minutos = (n: number) => new Date(las10.getTime() + n * 60_000);

const nuevoQr = (bs = 232.8) =>
  CobroQr.generar({
    id: 'qr1',
    pedidoId: 'p1',
    tiendaId: 'dr',
    mayoristaId: 'lp',
    monto: Dinero.deBolivianos(bs),
    ahora: las10,
    vigenciaMinutos: 30,
  });

describe('CobroQr', () => {
  it('nace pendiente, con su plazo y un código que lleva el pedido y el monto', () => {
    const qr = nuevoQr();
    expect(qr.estado).toBe('PENDIENTE');
    expect(qr.venceEn).toEqual(minutos(30));
    expect(qr.codigo).toBe('ABASTO-QR|p1|23280|qr1');
    expect(qr.sacarEventos()).toEqual([]);
  });

  it('no acepta un monto en cero', () => {
    expect(() => nuevoQr(0)).toThrow(MontoInvalido);
  });

  it('al pagarlo avisa a la saga una sola vez', () => {
    const qr = nuevoQr();
    qr.pagar(minutos(5));
    qr.pagar(minutos(6));
    expect(qr.estado).toBe('PAGADO');
    expect(qr.pagadoEn).toEqual(minutos(5));
    expect(qr.sacarEventos()).toEqual([
      { tipo: 'cobro.qr_pagado', pedidoId: 'p1', tiendaId: 'dr', mayoristaId: 'lp', centavos: 23280 },
    ]);
  });

  it('no se puede pagar después del plazo', () => {
    const qr = nuevoQr();
    expect(() => qr.pagar(minutos(31))).toThrow(QrNoSePuedePagar);
    expect(qr.estado).toBe('PENDIENTE');
  });

  it('vence si nadie lo paga y la saga recibe el motivo', () => {
    const qr = nuevoQr();
    expect(qr.vencerSiCorresponde(minutos(29))).toBe(false);
    expect(qr.vencerSiCorresponde(minutos(31))).toBe(true);
    expect(qr.vencerSiCorresponde(minutos(32))).toBe(false);
    expect(qr.estado).toBe('VENCIDO');
    expect(qr.sacarEventos()).toEqual([
      expect.objectContaining({ tipo: 'cobro.rechazado', pedidoId: 'p1', motivo: 'El QR venció sin que se pagara' }),
    ]);
    expect(() => qr.pagar(minutos(33))).toThrow(QrNoSePuedePagar);
  });

  it('la compensación devuelve lo pagado una sola vez', () => {
    const qr = nuevoQr();
    qr.pagar(minutos(1));
    qr.sacarEventos();
    qr.devolver();
    qr.devolver();
    expect(qr.estado).toBe('DEVUELTO');
    expect(qr.sacarEventos()).toEqual([expect.objectContaining({ tipo: 'cobro.qr_devuelto', centavos: 23280 })]);
  });

  it('devolver un QR sin pagar lo anula', () => {
    const qr = nuevoQr();
    qr.devolver();
    expect(qr.estado).toBe('ANULADO');
    expect(() => qr.pagar(minutos(1))).toThrow(QrNoSePuedePagar);
  });
});
