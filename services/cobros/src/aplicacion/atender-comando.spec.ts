import { Dinero } from '../dominio/dinero.js';
import { LineaDeCredito } from '../dominio/linea-de-credito.js';
import { AtenderComando, type Comando } from './atender-comando.js';
import { AutorizarCredito, LiberarCredito } from './autorizar-credito.js';
import { CobroQrEnMemoria, OutboxEnMemoria, ProcesadosEnMemoria } from './cobro-qr.en-memoria.js';
import { DevolverQr, GenerarQr, PagarQr, VencerQrs } from './cobros-qr.js';
import { LineaDeCreditoEnMemoria } from './linea-de-credito.en-memoria.js';

let ahora = new Date('2026-10-28T14:00:00Z');
const reloj = { ahora: () => ahora };

function armar() {
  const lineas = new LineaDeCreditoEnMemoria([
    new LineaDeCredito({
      id: 'l1',
      tiendaId: 'dr',
      mayoristaId: 'lp',
      limite: Dinero.deBolivianos(4000),
      plazoDias: 15,
      reservas: new Map(),
    }),
  ]);
  const cobros = new CobroQrEnMemoria();
  const outbox = new OutboxEnMemoria();
  let n = 0;
  const atender = new AtenderComando(
    {
      autorizarCredito: new AutorizarCredito(lineas),
      liberarCredito: new LiberarCredito(lineas),
      generarQr: new GenerarQr(cobros, { vigenciaMinutos: 30, generarId: () => `qr${++n}`, reloj }),
      devolverQr: new DevolverQr(cobros),
    },
    outbox,
    new ProcesadosEnMemoria(),
  );
  /** Todo lo que la saga va a recibir, venga del agregado o directo del outbox */
  const eventos = () => [...lineas.outbox, ...cobros.outbox, ...outbox.eventos].map((e) => e.tipo);
  return { atender, lineas, cobros, outbox, eventos };
}

const comando = (id: string, tipo: string, centavos?: number): Comando => ({
  id,
  tipo,
  datos: { pedidoId: 'p1', tiendaId: 'dr', mayoristaId: 'lp', centavos },
});

beforeEach(() => {
  ahora = new Date('2026-10-28T14:00:00Z');
});

describe('Cobros en la saga de compra', () => {
  it('a crédito: autoriza y avisa a la saga', async () => {
    const { atender, eventos, lineas } = armar();
    expect(await atender.ejecutar(comando('m1', 'cobros.autorizar_credito', 172800))).toBe('atendido');
    expect(eventos()).toEqual(['cobro.credito_autorizado']);
    expect((await lineas.buscar('dr', 'lp'))?.disponible.texto()).toBe('Bs 2.272,00');
  });

  it('un mensaje repetido no descuenta dos veces', async () => {
    const { atender, eventos } = armar();
    await atender.ejecutar(comando('m1', 'cobros.autorizar_credito', 172800));
    expect(await atender.ejecutar(comando('m1', 'cobros.autorizar_credito', 172800))).toBe('repetido');
    expect(eventos()).toEqual(['cobro.credito_autorizado']);
  });

  it('sin cupo, la saga recibe cobro.rechazado con el motivo', async () => {
    const { atender, outbox } = armar();
    expect(await atender.ejecutar(comando('m1', 'cobros.autorizar_credito', 500000))).toBe('rechazado');
    expect(outbox.eventos).toEqual([
      expect.objectContaining({
        tipo: 'cobro.rechazado',
        pedidoId: 'p1',
        motivo: 'El pedido de Bs 5.000,00 supera el crédito disponible de Bs 4.000,00',
      }),
    ]);
  });

  it('una tienda sin crédito con ese mayorista también se rechaza', async () => {
    const { atender, outbox } = armar();
    const sinLinea = { ...comando('m1', 'cobros.autorizar_credito', 1000), datos: { pedidoId: 'p9', tiendaId: 'ec', mayoristaId: 'lp', centavos: 1000 } };
    expect(await atender.ejecutar(sinLinea)).toBe('rechazado');
    expect(outbox.eventos[0]).toMatchObject({ tipo: 'cobro.rechazado', pedidoId: 'p9' });
  });

  it('la compensación devuelve el cupo', async () => {
    const { atender, eventos, lineas } = armar();
    await atender.ejecutar(comando('m1', 'cobros.autorizar_credito', 172800));
    await atender.ejecutar(comando('m2', 'cobros.liberar_credito'));
    expect(eventos()).toEqual(['cobro.credito_autorizado', 'cobro.credito_liberado']);
    expect((await lineas.buscar('dr', 'lp'))?.disponible.texto()).toBe('Bs 4.000,00');
  });

  it('por QR: genera un QR por pedido y el pago avisa a la saga', async () => {
    const { atender, cobros, eventos } = armar();
    await atender.ejecutar(comando('m1', 'cobros.generar_qr', 23280));
    await atender.ejecutar(comando('m2', 'cobros.generar_qr', 23280));
    const qr = await cobros.porPedido('p1');
    expect(qr?.id).toBe('qr1');

    await new PagarQr(cobros, reloj).ejecutar('p1', 'dr');
    expect(eventos()).toEqual(['cobro.qr_pagado']);
  });

  it('solo la tienda que compró puede pagar el QR', async () => {
    const { atender, cobros } = armar();
    await atender.ejecutar(comando('m1', 'cobros.generar_qr', 23280));
    await expect(new PagarQr(cobros, reloj).ejecutar('p1', 'ec')).rejects.toThrow('Solo la tienda que compró');
  });

  it('un QR que nadie paga vence y la saga recibe cobro.rechazado', async () => {
    const { atender, cobros, eventos } = armar();
    await atender.ejecutar(comando('m1', 'cobros.generar_qr', 23280));
    ahora = new Date('2026-10-28T14:31:00Z');
    expect(await new VencerQrs(cobros, reloj).ejecutar()).toBe(1);
    expect(eventos()).toEqual(['cobro.rechazado']);
  });

  it('la compensación de un QR pagado lo devuelve', async () => {
    const { atender, cobros, eventos } = armar();
    await atender.ejecutar(comando('m1', 'cobros.generar_qr', 23280));
    await new PagarQr(cobros, reloj).ejecutar('p1', 'dr');
    await atender.ejecutar(comando('m2', 'cobros.devolver_qr'));
    expect(eventos()).toEqual(['cobro.qr_pagado', 'cobro.qr_devuelto']);
    expect((await cobros.porPedido('p1'))?.estado).toBe('DEVUELTO');
  });

  it('un comando que no conoce no rompe nada', async () => {
    const { atender, eventos } = armar();
    expect(await atender.ejecutar(comando('m1', 'cobros.otra_cosa'))).toBe('desconocido');
    expect(eventos()).toEqual([]);
  });
});
