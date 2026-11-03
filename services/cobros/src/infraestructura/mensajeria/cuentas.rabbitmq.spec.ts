import { pedidoConfirmadoDelSobre } from './cuentas.rabbitmq.js';

const datos = { pedidoId: 'p-1', codigo: 'A-1042', tiendaId: 'dr', mayoristaId: 'lp', metodoPago: 'credito', totalCentavos: 120000 };

describe('el sobre de pedido.confirmado (CU-09)', () => {
  it('se convierte en el pedido que abre la cuenta, con la hora del evento', () => {
    expect(pedidoConfirmadoDelSobre({ id: 'e1', tipo: 'pedido.confirmado', ocurridoEn: '2026-11-01T14:00:00Z', datos })).toEqual({
      ...datos,
      confirmadoEn: new Date('2026-11-01T14:00:00Z'),
    });
  });

  it('otros eventos o un pedido incompleto no abren nada', () => {
    expect(pedidoConfirmadoDelSobre({ id: 'e2', tipo: 'pedido.entregado', datos })).toBeNull();
    expect(pedidoConfirmadoDelSobre({ id: 'e3', tipo: 'pedido.confirmado', datos: { ...datos, tiendaId: undefined } })).toBeNull();
  });
});
