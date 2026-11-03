import { TestBed } from '@angular/core/testing';
import { GraphQL } from '../graphql';
import { ejemploDePedido, estadoDe, filtrarEntradas, motivoLegible, totalVisible, VistaConecta, type EntradaDeBitacora } from './conecta';

const entrada = (clave: string, cambios: Partial<EntradaDeBitacora> = {}): EntradaDeBitacora => ({
  clave,
  origen: 'whatsapp',
  estado: 'aplicada',
  ocurridoEn: new Date().toISOString(),
  tiendaId: 'dr',
  tiendaNombre: 'Tienda Doña Rosa',
  codigo: 'A-2001',
  total: 'Bs 120,00',
  error: null,
  ...cambios,
});

const ENTRADAS = [
  entrada('k2', { estado: 'repetida' }),
  entrada('k1'),
  entrada('k3', { origen: 'tienda-en-linea', estado: 'rechazada', codigo: null, total: null, error: 'El producto HP-0400 no existe' }),
  entrada('k4', { origen: 'app-sin-senal', codigo: 'A-2002' }),
];

describe('Conecta (F3)', () => {
  it('dice qué pasó con cada cosa que entró', () => {
    expect(estadoDe(ENTRADAS[0])).toEqual({ texto: 'Repetido: no se duplicó', clase: 'lima' });
    expect(estadoDe(ENTRADAS[1])).toEqual({ texto: 'Pedido creado', clase: 'exito' });
    expect(estadoDe(ENTRADAS[2])).toEqual({ texto: 'No entró', clase: 'error' });
  });

  it('el motivo técnico del Router se dice en español; el total en cero (sin precios todavía) no se muestra', () => {
    expect(motivoLegible('invalid input value at `$entrada.lineas[0].presentacion`: found JSON string for GraphQL type `Presentacion!`')).toBe(
      'Llegó con un dato que no se entiende: la presentación de la línea 1',
    );
    expect(motivoLegible('El producto HP-0400 no existe')).toBe('El producto HP-0400 no existe');
    expect(totalVisible(entrada('x', { total: 'Bs 0,00' }))).toBeNull();
    expect(totalVisible(entrada('x'))).toBe('Bs 120,00');
  });

  it('filtra por origen y por los que tuvieron problemas', () => {
    const claves = (l: EntradaDeBitacora[]) => l.map((e) => e.clave);
    expect(claves(filtrarEntradas(ENTRADAS, 'whatsapp'))).toEqual(['k2', 'k1']);
    expect(claves(filtrarEntradas(ENTRADAS, 'app-sin-senal'))).toEqual(['k4']);
    expect(claves(filtrarEntradas(ENTRADAS, 'problemas'))).toEqual(['k3']);
    expect(filtrarEntradas(ENTRADAS, 'todos')).toHaveLength(4);
  });

  it('el ejemplo para la tienda en línea lleva la Idempotency-Key y el mayorista', () => {
    const ejemplo = ejemploDePedido('http://localhost:8084', 'lp');
    expect(ejemplo).toContain('http://localhost:8084/v1/pedidos');
    expect(ejemplo).toContain('Idempotency-Key');
    expect(ejemplo).toContain('"mayoristaId":"lp"');
  });

  it('muestra la bitácora de Conecta con el resumen', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: GraphQL,
          useValue: {
            sesion: () => null,
            leerDeConecta: async () => ({ resumen: { aplicadas: 2, repetidas: 1, conProblemas: 1 }, entradas: ENTRADAS }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(VistaConecta);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = ((fixture.nativeElement as HTMLElement).shadowRoot ?? fixture.nativeElement).textContent ?? '';
    expect(texto).toContain('Pedidos que entraron');
    expect(texto).toContain('Repetido: no se duplicó');
    expect(texto).toContain('El producto HP-0400 no existe');
    expect(texto).toContain('Tienda Doña Rosa');
  });
});
