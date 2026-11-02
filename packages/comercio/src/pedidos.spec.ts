import { describe, expect, it } from 'vitest';
import { cambiarCantidad, type ItemDeCarrito } from './carrito';
import { compensaciones, esPasoDePagoQr, estadoVisible, filtrarPedidos, lineaDeTiempo, pasoActual, porPagar, progresoDelPedido, terminado, tiempoRestante, titularDelPedido, type Pedido } from './pedidos';

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

describe('contra entrega', () => {
  it('no tiene paso de pago antes: después del stock espera al mayorista y se paga al recibir', () => {
    const p = pedido({ estado: 'POR_CONFIRMAR', metodoPago: 'CONTRA_ENTREGA' });
    expect(nodos(p)).toEqual([
      'Pedido enviado:hecho',
      'Stock reservado:hecho',
      'Confirmación del mayorista:proc',
      'En preparación:pend',
      'En camino:pend',
      'Entregado:pend',
    ]);
    expect(lineaDeTiempo(p).at(-1)?.detalle).toBe('Pagas al recibir, en efectivo o QR');
  });

  it('si el mayorista lo rechaza no se cobró nada', () => {
    const p = pedido({ estado: 'RECHAZADO', metodoPago: 'CONTRA_ENTREGA', motivoRechazo: 'No llego hoy' });
    expect(lineaDeTiempo(p).at(-1)).toEqual({ nombre: 'Confirmación del mayorista', detalle: 'No llego hoy', nodo: 'rojo' });
    expect(compensaciones(p)).toEqual(['Liberamos la reserva del stock', 'No se te cobró nada']);
  });
});

describe('Compras: la línea de tiempo arriba (02/11)', () => {
  it('el paso actual es el que está en proceso; si no hay, el que sigue', () => {
    const pagar = pedido({ cobro: qr('PENDIENTE') });
    const pasos = lineaDeTiempo(pagar);
    expect(pasos[pasoActual(pasos)].nombre).toBe('Pago por QR');
    expect(esPasoDePagoQr(pasos[pasoActual(pasos)])).toBe(true);
    const confirmado = lineaDeTiempo(pedido({ estado: 'CONFIRMADO', cobro: qr('PAGADO') }));
    expect(confirmado[pasoActual(confirmado)].nombre).toBe('En preparación');
    expect(pasoActual(lineaDeTiempo(pedido({ estado: 'ENTREGADO', cobro: qr('PAGADO') })))).toBe(-1);
    expect(pasoActual(lineaDeTiempo(pedido({ estado: 'RECHAZADO', motivoRechazo: 'Sin stock', total: { centavos: 0, texto: 'Bs 0,00' } })))).toBe(-1);
  });

  it('el titular dice qué pasa ahora y qué hacer', () => {
    expect(titularDelPedido(pedido({ total: { centavos: 0, texto: 'Bs 0,00' } })).titulo).toBe('Reservando tu pedido');
    expect(titularDelPedido(pedido({ cobro: qr('PENDIENTE') })).titulo).toBe('Paga para que lo preparemos');
    expect(titularDelPedido(pedido({ estado: 'DESPACHADO', metodoPago: 'CONTRA_ENTREGA' })).detalle).toBe('Ten listos Bs 232,80 para pagar al recibir');
    expect(titularDelPedido(pedido({ estado: 'RECHAZADO' })).titulo).toBe('Tu pedido no siguió');
  });

  it('el progreso cuenta los pasos hechos', () => {
    const p = progresoDelPedido(pedido({ estado: 'EN_PREPARACION', cobro: qr('PAGADO') }));
    expect(p.hechos).toBe(4);
    expect(p.pasos[p.actual]).toMatchObject({ nombre: 'En preparación', nodo: 'proc' });
    const enCamino = progresoDelPedido(pedido({ estado: 'DESPACHADO', cobro: qr('PAGADO') }));
    expect(enCamino.pasos[enCamino.actual]).toMatchObject({ nombre: 'En camino', nodo: 'proc' });
    expect(terminado({ estado: 'ENTREGADO' })).toBe(true);
  });
});
