import { TestBed } from '@angular/core/testing';
import { GraphQL } from '../graphql';
import { agruparPorProveedor, partesDelProveedor, porcentaje, VistaCompras, type LineaDeCompra } from './compras';
import { columnaDe, filtrarPedidos, SIGUIENTE_PASO, textoDePago, type PedidoFila } from './pedidos';

const linea = (id: string, nombre: string, proveedor: string | null, costo: number | null, unidades: number, venta: number, pedidos = ['A-1']): LineaDeCompra => ({
  unidades,
  venta: { centavos: venta },
  pedidos,
  producto: { id, nombre, proveedor, costoUnitario: costo === null ? null : { centavos: costo } },
});

const LISTA: LineaDeCompra[] = [
  linea('AB-001', 'Arroz grano largo 1 kg', 'Mercado Los Pozos', 735, 48, 48 * 790, ['A-1', 'A-2']),
  linea('AB-036', 'Pilas AA · par', 'Mercado Mutualista', 540, 36, 36 * 650),
  linea('AB-002', 'Azúcar blanca 1 kg', 'Mercado Los Pozos', 655, 12, 12 * 720),
  linea('X-1', 'Producto sin costo', null, null, 10, 1000),
];

describe('Lista de compras', () => {
  it('agrupa por dónde se compra, con costo, venta y margen; lo que no tiene proveedor va al final', () => {
    const grupos = agruparPorProveedor(LISTA);

    expect(grupos.map((g) => g.proveedor)).toEqual(['Mercado Los Pozos', 'Mercado Mutualista', 'Sin proveedor cargado']);
    const losPozos = grupos[0];
    expect(losPozos.lineas.map((l) => l.producto.id)).toEqual(['AB-001', 'AB-002']);
    expect(losPozos.costoCentavos).toBe(48 * 735 + 12 * 655);
    expect(losPozos.ventaCentavos).toBe(48 * 790 + 12 * 720);
    expect(losPozos.lineas[0].margenCentavos).toBe(48 * (790 - 735));
    expect(grupos[2].lineas[0].costoCentavos).toBeNull();
    expect(grupos[2].lineas[0].margenCentavos).toBeNull();
  });

  it('el margen se muestra como porcentaje de la venta', () => {
    expect(porcentaje(2640, 37920)).toBe('7 %');
    expect(porcentaje(0, 0)).toBe('—');
  });

  it('la pantalla muestra cada puesto con lo que hay que comprar', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: GraphQL, useValue: { consultar: async () => ({ listaDeCompras: LISTA }) } }],
    });
    const fixture = TestBed.createComponent(VistaCompras);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).shadowRoot?.textContent ?? (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Los Pozos');
    expect(texto).toContain('Arroz grano largo 1 kg');
    expect(texto).toContain('48 u.');
    expect(texto).toContain('A-1');
    expect(texto).toContain('A-2');
    expect(texto).toContain('Sin costo');
    expect(texto).toContain('0 de 2 comprados');
  });

  it('el nombre del puesto se parte en título y detalle', () => {
    expect(partesDelProveedor('Mercado Los Pozos')).toEqual({ titulo: 'Los Pozos', detalle: 'Mercado' });
    expect(partesDelProveedor('Distribuidora (pedido por WhatsApp)')).toEqual({ titulo: 'Distribuidora', detalle: 'Pedido por WhatsApp' });
    expect(partesDelProveedor('Don Julio')).toEqual({ titulo: 'Don Julio', detalle: 'Proveedor' });
  });
});

describe('Pedidos: después de confirmar', () => {
  it('el botón avanza de a un paso hasta entregar', () => {
    expect(SIGUIENTE_PASO['CONFIRMADO']).toBe('Preparar');
    expect(SIGUIENTE_PASO['EN_PREPARACION']).toBe('Despachar');
    expect(SIGUIENTE_PASO['DESPACHADO']).toBe('Marcar entregado');
    expect(SIGUIENTE_PASO['ENTREGADO']).toBeUndefined();
  });
});

const pedido = (codigo: string, estado: string, creadoEn: string, tienda = 'Doña Rosa', centavos = 1000): PedidoFila => ({
  id: codigo,
  codigo,
  estado,
  metodoPago: 'QR',
  creadoEn,
  total: { texto: '', centavos },
  tienda: { id: tienda, nombre: tienda },
  entrega: null,
  lineas: [],
});

describe('Pedidos: el tablero', () => {
  const ahora = new Date('2026-11-02T15:00:00').getTime();
  const LISTA = [
    pedido('A-1340', 'POR_CONFIRMAR', '2026-11-02T13:30:00', 'Pensión El Buen Sabor', 5000),
    pedido('A-1342', 'POR_CONFIRMAR', '2026-11-02T14:50:00', 'Andrés Quispe', 2000),
    pedido('A-1338', 'CONFIRMADO', '2026-11-01T10:00:00', 'Tienda Don Pedro', 9000),
    pedido('A-1300', 'ENTREGADO', '2026-10-30T10:00:00'),
  ];

  it('cada estado va a su columna', () => {
    expect(['POR_CONFIRMAR', 'CONFIRMADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'RECHAZADO'].map(columnaDe)).toEqual([
      'confirmar', 'preparar', 'preparar', 'reparto', 'cerrado', 'cerrado',
    ]);
  });

  it('filtra por hoy, urgentes (más de 1 h por confirmar) y entregados', () => {
    const codigos = (f: Parameters<typeof filtrarPedidos>[1], orden: Parameters<typeof filtrarPedidos>[3] = 'recientes') =>
      filtrarPedidos(LISTA, f, '', orden, ahora).map((p) => p.codigo);
    expect(codigos('todos')).toEqual(['A-1342', 'A-1340', 'A-1338']);
    expect(codigos('hoy')).toEqual(['A-1342', 'A-1340']);
    expect(codigos('urgentes')).toEqual(['A-1340']);
    expect(codigos('cerrados')).toEqual(['A-1300']);
    expect(codigos('todos', 'monto')).toEqual(['A-1338', 'A-1340', 'A-1342']);
  });

  it('busca por código o por tienda (un nombre que empieza con «A» no se toma como código)', () => {
    const buscar = (q: string) => filtrarPedidos(LISTA, 'todos', q, 'recientes', ahora).map((p) => p.codigo);
    expect(buscar('A-1340')).toEqual(['A-1340']);
    expect(buscar('1338')).toEqual(['A-1338']);
    expect(buscar('andrés')).toEqual(['A-1342']);
  });

  it('dice el pago con palabras', () => {
    expect(textoDePago({ metodoPago: 'QR', cobro: { estado: 'PAGADO' } }).texto).toBe('QR pagado');
    expect(textoDePago({ metodoPago: 'QR', cobro: null }).texto).toBe('QR por pagar');
    expect(textoDePago({ metodoPago: 'CONTRA_ENTREGA' }).texto).toBe('Contra entrega');
  });
});
