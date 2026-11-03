import { CanalDeTiendas } from './canal-de-tiendas.js';

const evento = (tipo: string, tiendaId: string | undefined, extra: Record<string, unknown> = {}) => ({
  id: 'e1',
  tipo,
  ocurridoEn: '2026-11-02T10:00:00Z',
  orgId: 'abasto',
  datos: { pedidoId: 'p1', codigo: 'A-1', tiendaId, mayoristaId: 'abasto', totalCentavos: 57000, lineas: [{ productoId: 'AB-101' }], ...extra },
});

describe('el canal en tiempo real reparte por tienda', () => {
  it('cada tienda recibe solo lo suyo, en todos sus teléfonos', () => {
    const canal = new CanalDeTiendas();
    const rosa1 = vi.fn();
    const rosa2 = vi.fn();
    const carmen = vi.fn();
    canal.suscribir('rosa', rosa1);
    canal.suscribir('rosa', rosa2);
    canal.suscribir('carmen', carmen);
    expect(canal.publicar(evento('pedido.confirmado', 'rosa'))).toBe(2);
    expect(rosa1).toHaveBeenCalledWith({ tipo: 'pedido.confirmado', pedidoId: 'p1', codigo: 'A-1', ocurridoEn: '2026-11-02T10:00:00Z' });
    expect(rosa2).toHaveBeenCalledTimes(1);
    expect(carmen).not.toHaveBeenCalled();
  });

  it('el aviso no lleva montos ni líneas: la app vuelve a pedir el pedido con su sesión', () => {
    const canal = new CanalDeTiendas();
    const rosa = vi.fn();
    canal.suscribir('rosa', rosa);
    canal.publicar(evento('cobro.qr_generado', 'rosa', { centavos: 57000, venceEn: 'x' }));
    expect(Object.keys(rosa.mock.calls[0][0]).sort()).toEqual(['codigo', 'ocurridoEn', 'pedidoId', 'tipo']);
  });

  it('no reparte lo que no es de pedidos ni cobros, ni lo que no trae tienda', () => {
    const canal = new CanalDeTiendas();
    const rosa = vi.fn();
    canal.suscribir('rosa', rosa);
    expect(canal.publicar(evento('stock.reservado', 'rosa'))).toBe(0);
    expect(canal.publicar(evento('producto.stock_cambiado', 'rosa'))).toBe(0);
    expect(canal.publicar(evento('pedido.creado', undefined))).toBe(0);
    expect(rosa).not.toHaveBeenCalled();
  });

  it('al desuscribirse deja de recibir y una conexión rota no frena a las demás', () => {
    const canal = new CanalDeTiendas();
    const rota = vi.fn(() => {
      throw new Error('cerrada');
    });
    const sana = vi.fn();
    const salir = canal.suscribir('rosa', rota);
    canal.suscribir('rosa', sana);
    canal.publicar(evento('pedido.despachado', 'rosa'));
    expect(sana).toHaveBeenCalledTimes(1);
    salir();
    expect(canal.conexiones()).toBe(1);
  });
});
