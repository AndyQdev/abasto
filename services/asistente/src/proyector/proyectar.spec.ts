import { proyectar, type Evento } from './proyectar.js';

const evento = (tipo: string, datos: Record<string, unknown>): Evento => ({
  id: 'e1',
  tipo,
  version: 1,
  ocurridoEn: '2026-10-20T08:50:00-04:00',
  orgId: 'lp',
  datos,
});

describe('Proyector de reportes', () => {
  it('un pedido confirmado al contado suma a las ventas del día', () => {
    const s = proyectar(evento('pedido.confirmado', { pedidoId: 'A-1042', totalCentavos: 172800, metodoPago: 'qr' }));
    expect(s).toHaveLength(1);
    expect(s[0].parametros).toEqual(['lp', '2026-10-20', 172800]);
  });

  it('a crédito, además abre la cuenta por cobrar', () => {
    const s = proyectar(
      evento('pedido.confirmado', {
        pedidoId: 'A-1051',
        tiendaId: 'am',
        tiendaNombre: 'Almacén Mery',
        totalCentavos: 24000,
        metodoPago: 'credito',
        vence: '2026-11-04',
      }),
    );
    expect(s.map((x) => x.sql)).toEqual([expect.stringContaining('ventas_diarias'), expect.stringContaining('cuentas_por_cobrar')]);
  });

  it('ignora los eventos que no cambian reportes', () => {
    expect(proyectar(evento('pedido.creado', {}))).toEqual([]);
  });
});
