import { Dinero } from './dinero.js';
import { LimiteDeCreditoExcedido, MontoInvalido } from './errores.js';
import { LineaDeCredito } from './linea-de-credito.js';

const nuevaLinea = (limiteBs = 4000) =>
  new LineaDeCredito({
    id: 'l1',
    tiendaId: 'dr',
    mayoristaId: 'lp',
    limite: Dinero.deBolivianos(limiteBs),
    plazoDias: 15,
    reservas: new Map(),
  });

describe('Dinero', () => {
  it('se muestra como en las pantallas de Abasto', () => {
    expect(Dinero.deBolivianos(1728).texto()).toBe('Bs 1.728,00');
    expect(Dinero.deCentavos(5).texto()).toBe('Bs 0,05');
  });

  it('no acepta fracciones de centavo', () => {
    expect(() => Dinero.deCentavos(10.5)).toThrow(MontoInvalido);
  });
});

describe('LineaDeCredito', () => {
  it('descuenta el pedido del cupo disponible', () => {
    const linea = nuevaLinea();
    linea.autorizar('A-1042', Dinero.deBolivianos(1728));
    expect(linea.disponible.texto()).toBe('Bs 2.272,00');
    expect(linea.sacarEventos()).toEqual([
      expect.objectContaining({ tipo: 'cobro.credito_autorizado', pedidoId: 'A-1042', centavos: 172800 }),
    ]);
  });

  it('nunca pasa el límite', () => {
    const linea = nuevaLinea(1000);
    expect(() => linea.autorizar('A-1', Dinero.deBolivianos(1000.01))).toThrow(LimiteDeCreditoExcedido);
    expect(linea.usado.centavos).toBe(0);
  });

  it('un mensaje repetido no descuenta dos veces', () => {
    const linea = nuevaLinea();
    linea.autorizar('A-1', Dinero.deBolivianos(500));
    linea.autorizar('A-1', Dinero.deBolivianos(500));
    expect(linea.usado.texto()).toBe('Bs 500,00');
    expect(linea.sacarEventos()).toHaveLength(1);
  });

  it('el mismo pedido con otro monto es un error, no un reintento', () => {
    const linea = nuevaLinea();
    linea.autorizar('A-1', Dinero.deBolivianos(500));
    expect(() => linea.autorizar('A-1', Dinero.deBolivianos(600))).toThrow(MontoInvalido);
  });

  it('liberar devuelve el cupo y es idempotente', () => {
    const linea = nuevaLinea();
    linea.autorizar('A-1', Dinero.deBolivianos(500));
    linea.sacarEventos();
    linea.liberar('A-1');
    linea.liberar('A-1');
    expect(linea.disponible.texto()).toBe('Bs 4.000,00');
    expect(linea.sacarEventos()).toHaveLength(1);
  });
});
