import { describe, expect, it } from 'vitest';
import { cambiarCantidad, type ItemDeCarrito } from './carrito';
import { compensaciones, estadoVisible, filtrarPedidos, lineaDeTiempo, porPagar, tiempoRestante, type Pedido } from './pedidos';

type Base = Pick<Pedido, 'estado' | 'metodoPago' | 'cobro' | 'total' | 'motivoRechazo'>;

const pedido = (parcial: Partial<Base>): Base => ({
  estado: 'PENDIENTE',
  metodoPago: 'QR',
  cobro: null,
  total: { centavos: 23280, texto: 'Bs 232,80' },
  motivoRechazo: null,
  ...parcial,
});
const qr = (estado: NonNullable<Pedido['cobro']>['estado']) => ({ estado, codigo: 'ABASTO-QR|p1', venceEn: '2026-10-28T14:30:00Z', monto: { texto: 'Bs 232,80' } });
const nodos = (p: Base) => lineaDeTiempo(p).map((x) => `${x.nombre}:${x.nodo}`);

describe('seguimiento del pedido', () => {
  it('recién creado, todavía sin precio: está reservando el stock', () => {
    const p = pedido({ total: { centavos: 0, texto: 'Bs 0,00' } });
    expect(estadoVisible(p).texto).toBe('Reservando');
    expect(nodos(p).slice(0, 3)).toEqual(['Pedido enviado:hecho', 'Reservando el stock:proc', 'Pago por QR:pend']);
  });

  it('con el QR generado, la tienda tiene que pagar', () => {
    const p = pedido({ cobro: qr('PENDIENTE') });
    expect(estadoVisible(p)).toEqual({ texto: 'Por pagar', clase: 'ins-ambar' });
    expect(porPagar(p)).toBe(true);
    expect(lineaDeTiempo(p)[2]).toEqual({ nombre: 'Pago por QR', detalle: 'Esperando tu pago', nodo: 'proc' });
  });

  it('pagado, espera al mayorista', () => {
    const p = pedido({ estado: 'POR_CONFIRMAR', cobro: qr('PAGADO') });
    expect(estadoVisible(p).texto).toBe('Esperando al mayorista');
    expect(porPagar(p)).toBe(false);
    expect(nodos(p).slice(2, 4)).toEqual(['Pago por QR:hecho', 'Confirmación del mayorista:proc']);
  });

  it('a crédito no hay QR: el paso del pago es la autorización', () => {
    const p = pedido({ metodoPago: 'CREDITO' });
    expect(lineaDeTiempo(p)[2]).toEqual({ nombre: 'Crédito con el mayorista', detalle: 'Autorizando el crédito', nodo: 'proc' });
    expect(nodos({ ...p, estado: 'CONFIRMADO' })[3]).toBe('Confirmación del mayorista:hecho');
  });

  it('entregado: todos los pasos hechos', () => {
    const p = pedido({ estado: 'ENTREGADO', cobro: qr('PAGADO') });
    expect(lineaDeTiempo(p).every((x) => x.nodo === 'hecho')).toBe(true);
  });

  it('sin stock: falla la reserva y no se cobró nada', () => {
    const p = pedido({ estado: 'RECHAZADO', total: { centavos: 0, texto: 'Bs 0,00' }, motivoRechazo: 'Sin stock' });
    expect(lineaDeTiempo(p).at(-1)).toEqual({ nombre: 'Reserva del stock', detalle: 'Sin stock', nodo: 'rojo' });
    expect(compensaciones(p)).toEqual(['No se reservó nada ni se te cobró']);
  });

  it('QR vencido: se libera el stock y no se cobró', () => {
    const p = pedido({ estado: 'RECHAZADO', cobro: qr('VENCIDO'), motivoRechazo: 'El QR venció sin que se pagara' });
    expect(lineaDeTiempo(p).at(-1)).toMatchObject({ nombre: 'Pago por QR', nodo: 'rojo' });
    expect(compensaciones(p)).toEqual(['Liberamos la reserva del stock', 'No se te cobró nada']);
  });

  it('el mayorista rechaza un pedido pagado: se devuelve el pago', () => {
    const p = pedido({ estado: 'RECHAZADO', cobro: qr('DEVUELTO'), motivoRechazo: 'No llego a entregar hoy' });
    expect(lineaDeTiempo(p).at(-1)).toEqual({ nombre: 'Confirmación del mayorista', detalle: 'No llego a entregar hoy', nodo: 'rojo' });
    expect(compensaciones(p)).toEqual(['Liberamos la reserva del stock', 'Te devolvimos Bs 232,80 de tu pago por QR']);
  });

  it('a crédito rechazado: se devuelve el cupo', () => {
    const p = pedido({ estado: 'RECHAZADO', metodoPago: 'CREDITO', motivoRechazo: 'No llego' });
    expect(compensaciones(p)).toContain('Te devolvimos Bs 232,80 a tu crédito');
  });

  it('filtra por pestaña', () => {
    const lista = [{ estado: 'PENDIENTE' }, { estado: 'ENTREGADO' }, { estado: 'RECHAZADO' }, { estado: 'CONFIRMADO' }] as Pick<Pedido, 'estado'>[];
    expect(filtrarPedidos(lista, 'en_curso').map((p) => p.estado)).toEqual(['PENDIENTE', 'CONFIRMADO']);
    expect(filtrarPedidos(lista, 'cancelados').map((p) => p.estado)).toEqual(['RECHAZADO']);
  });

  it('cuenta el tiempo que queda para pagar', () => {
    expect(tiempoRestante('2026-10-28T14:30:00Z', new Date('2026-10-28T14:15:30Z').getTime())).toBe('14:30');
    expect(tiempoRestante('2026-10-28T14:30:00Z', new Date('2026-10-28T14:31:00Z').getTime())).toBe('0:00');
  });
});

describe('carrito', () => {
  const item: ItemDeCarrito = {
    productoId: 'HB-0090',
    nombre: 'Pasta dental',
    mayoristaId: 'lp',
    mayoristaNombre: 'Distribuidora Los Pozos',
    presentacion: 'DOCENA',
    cantidad: 1,
    unidadesPorPresentacion: 12,
    precioUnitarioCentavos: 631,
  };

  it('la cantidad sube y baja de a uno, pero nunca baja de 1', () => {
    expect(cambiarCantidad([item], 'HB-0090', 'DOCENA', 2)[0].cantidad).toBe(3);
    expect(cambiarCantidad([item], 'HB-0090', 'DOCENA', -1)[0].cantidad).toBe(1);
  });
});
