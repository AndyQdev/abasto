import { TestBed } from '@angular/core/testing';
import { GraphQL } from '../graphql';
import { alternarUso, filtrarPorUso, VistaProductos, type ProductoFila } from './productos';

const producto = (id: string, nombre: string, usos: string[]): ProductoFila => ({
  id,
  codigo: id,
  nombre,
  rubro: 'Varios',
  stock: 0,
  estado: 'ACTIVO',
  usos,
  escalas: [{ presentacion: 'UNIDAD', cantidad: 1, precioUnitario: { texto: 'Bs 10,00' } }],
});

const LISTA = [
  producto('AB-018', 'Yogurt bebible PIL durazno 1 L', ['hogar', 'tienda']),
  producto('AB-104', 'Levadura seca instantánea 500 g', ['panaderia']),
  producto('AB-115', 'Huevo · maple de 30', ['hogar', 'tienda', 'panaderia']),
  producto('X-1', 'Arroz grano largo 1 kg', []),
];

describe('Productos: a quién se muestra cada uno', () => {
  it('filtra por área: el panadero no ve yogurt', () => {
    expect(filtrarPorUso(LISTA, 'panaderia').map((p) => p.id)).toEqual(['AB-104', 'AB-115']);
    expect(filtrarPorUso(LISTA, 'ninguno').map((p) => p.id)).toEqual(['X-1']);
    expect(filtrarPorUso(LISTA, 'todos')).toHaveLength(4);
  });

  it('prender y apagar un uso deja la lista en el orden de siempre', () => {
    expect(alternarUso(['tienda'], 'hogar')).toEqual(['hogar', 'tienda']);
    expect(alternarUso(['hogar', 'tienda'], 'hogar')).toEqual(['tienda']);
  });

  it('un toque en la etiqueta guarda los usos en Catálogo', async () => {
    const llamadas: Record<string, unknown>[] = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: GraphQL,
          useValue: {
            consultar: async (_q: string, v: Record<string, unknown> = {}) => {
              llamadas.push(v);
              return v['usos'] ? { editarProducto: { id: v['id'], usos: v['usos'] } } : { misProductos: LISTA };
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(VistaProductos);
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance.alternar(LISTA[1], 'horneados');

    expect(llamadas.at(-1)).toEqual({ id: 'AB-104', usos: ['panaderia', 'horneados'] });
    expect(fixture.componentInstance.productos().find((p) => p.id === 'AB-104')?.usos).toEqual(['panaderia', 'horneados']);
  });
});
