import { TestBed } from '@angular/core/testing';
import { GraphQL } from '../graphql';
import { agruparPorProveedor, porcentaje, VistaCompras, type LineaDeCompra } from './compras';
import { SIGUIENTE_PASO } from './pedidos';

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
    expect(texto).toContain('Mercado Los Pozos');
    expect(texto).toContain('Arroz grano largo 1 kg');
    expect(texto).toContain('48 u.');
    expect(texto).toContain('A-1, A-2');
    expect(texto).toContain('Sin costo');
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
