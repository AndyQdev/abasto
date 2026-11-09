import { PLAZO_CREDITO_DIAS, proyectar, tiendasQueNecesita, type Evento } from './proyectar.js';

const evento = (tipo: string, datos: Record<string, unknown>): Evento => ({
  id: 'e1',
  tipo,
  version: 1,
  ocurridoEn: '2026-10-20T08:50:00-04:00',
  orgId: 'lp',
  datos,
});

// Lo que publica Pedidos en cada pedido.* (SagaDeCompra.datosDe): sin nombre de tienda ni vencimiento
const pedido = (metodoPago: 'qr' | 'credito' | 'contra_entrega', extra: Record<string, unknown> = {}) => ({
  pedidoId: '7b0d4f3e-0001-4000-8000-000000001051',
  codigo: 'A-1051',
  tiendaId: 'am',
  mayoristaId: 'lp',
  metodoPago,
  totalCentavos: 24000,
  ...extra,
});

const tiendas = { am: 'Almacén Mery' };

describe('Proyector de reportes', () => {
  it('un pedido confirmado al contado actualiza el pedido y suma a las ventas del día', () => {
    const s = proyectar(evento('pedido.confirmado', pedido('qr', { totalCentavos: 172800 })), tiendas);

    expect(s.map((x) => x.sql)).toEqual([expect.stringContaining('INTO pedidos'), expect.stringContaining('ventas_diarias')]);
    expect(s[1].parametros).toEqual(['lp', '2026-10-20', 172800]);
  });

  it('a crédito abre la cuenta por cobrar con el nombre de la tienda y el plazo por defecto', () => {
    const s = proyectar(evento('pedido.confirmado', pedido('credito')), tiendas);

    const cuenta = s.find((x) => x.sql.includes('cuentas_por_cobrar'));
    expect(PLAZO_CREDITO_DIAS).toBe(15);
    expect(cuenta?.parametros).toEqual(['lp', 'A-1051', 'am', 'Almacén Mery', 24000, '2026-11-04']);
  });

  it('si el evento ya trae el vencimiento, lo respeta', () => {
    const s = proyectar(evento('pedido.confirmado', pedido('credito', { vence: '2026-11-30' })), tiendas);

    expect(s.find((x) => x.sql.includes('cuentas_por_cobrar'))?.parametros.at(-1)).toBe('2026-11-30');
  });

  it('sin el nombre de la tienda usa su id, no deja el campo vacío', () => {
    const s = proyectar(evento('pedido.confirmado', pedido('credito')));

    expect(s.find((x) => x.sql.includes('cuentas_por_cobrar'))?.parametros[3]).toBe('am');
  });

  it.each([
    ['pedido.creado', 'PENDIENTE'],
    ['pedido.por_confirmar', 'POR_CONFIRMAR'],
    ['pedido.rechazado', 'RECHAZADO'],
  ])('%s deja el pedido en %s', (tipo, estado) => {
    const [s] = proyectar(evento(tipo, pedido('qr', { motivo: 'Sin stock' })), tiendas);

    expect(s.sql).toContain('INTO pedidos');
    expect(s.parametros[4]).toBe('Almacén Mery');
    expect(s.parametros[7]).toBe(estado);
    expect(s.parametros[8]).toBe(tipo === 'pedido.rechazado' ? 'Sin stock' : null);
  });

  it('pedido.creado nunca pisa un estado posterior que llegó antes', () => {
    const [creado] = proyectar(evento('pedido.creado', pedido('qr')), tiendas);
    const [rechazado] = proyectar(evento('pedido.rechazado', pedido('qr')), tiendas);

    expect(creado.sql).toContain('DO NOTHING');
    expect(rechazado.sql).toContain('DO UPDATE');
  });

  it('un evento que llega tarde no pisa un estado más nuevo (RabbitMQ no garantiza el orden entre reintentos)', () => {
    // Visto en la nube el 09/11: A-1115 llegó «rechazado» y después «por confirmar», 400 ms más viejo, y quedó por confirmar
    const [porConfirmar] = proyectar(evento('pedido.por_confirmar', pedido('contra_entrega')), tiendas);

    expect(porConfirmar.sql).toMatch(/DO UPDATE[\s\S]*WHERE pedidos\.actualizado_en <= EXCLUDED\.actualizado_en/);
  });

  it('el pago descuenta la cuenta buscándola por código o por id del pedido', () => {
    const [s] = proyectar(evento('cobro.pago_registrado', { pedidoId: 'uuid-1', centavos: 5000 }));

    expect(s.sql).toContain('pedido_id IN ($2, $3)');
    expect(s.parametros).toEqual(['lp', 'uuid-1', 'uuid-1', 5000]);
  });

  it('el stock que avisa Catálogo reemplaza al anterior', () => {
    const [s] = proyectar(evento('producto.stock_cambiado', { productoId: 'HP-0400', nombre: 'Shampoo 400 ml', stock: 216 }));

    expect(s.parametros).toEqual(['lp', 'HP-0400', 'Shampoo 400 ml', 216]);
  });

  it.each([
    ['pedido.en_preparacion', 'EN_PREPARACION'],
    ['pedido.despachado', 'DESPACHADO'],
    ['pedido.entregado', 'ENTREGADO'],
  ])('%s avanza la entrega del pedido sin sumar otra venta', (tipo, estado) => {
    const sentencias = proyectar(evento(tipo, pedido('contra_entrega')), tiendas);

    expect(sentencias).toHaveLength(1);
    expect(sentencias[0].sql).toContain('DO UPDATE SET estado');
    expect(sentencias[0].parametros[5]).toBe('contra_entrega');
    expect(sentencias[0].parametros[7]).toBe(estado);
  });

  it('pide nombres solo para los eventos de pedidos', () => {
    expect(tiendasQueNecesita(evento('pedido.creado', pedido('qr')))).toEqual(['am']);
    expect(tiendasQueNecesita(evento('stock.reservado', { pedidoId: 'x' }))).toEqual([]);
  });

  it('ignora los eventos que no cambian reportes', () => {
    expect(proyectar(evento('stock.reservado', {}))).toEqual([]);
  });
});
