import { pedidoDelSobre } from './entregas.rabbitmq.js';

const datos = {
  pedidoId: 'p-1',
  codigo: 'A-0001',
  tiendaId: 'rosa',
  mayoristaId: 'abasto',
  metodoPago: 'contra_entrega',
  totalCentavos: 57000,
  lineas: [{ productoId: 'AB-101', presentacion: 'UNIDAD', cantidad: 2, unidades: 2, subtotalCentavos: 57000 }],
};

describe('el sobre de pedido.entregado', () => {
  it('se convierte en el pedido que registra Mi negocio', () => {
    expect(pedidoDelSobre({ id: 'e1', tipo: 'pedido.entregado', datos } as never)).toEqual({
      pedidoId: 'p-1',
      codigo: 'A-0001',
      tiendaId: 'rosa',
      totalCentavos: 57000,
      lineas: [{ productoId: 'AB-101', presentacion: 'UNIDAD', unidades: 2, subtotalCentavos: 57000 }],
    });
  });

  it('otros eventos y los entregados sin líneas (de antes del 01/11) se ignoran', () => {
    expect(pedidoDelSobre({ id: 'e2', tipo: 'pedido.despachado', datos } as never)).toBeNull();
    expect(pedidoDelSobre({ id: 'e3', tipo: 'pedido.entregado', datos: { ...datos, lineas: undefined } } as never)).toBeNull();
  });
});
