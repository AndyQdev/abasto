import { TestBed } from '@angular/core/testing';
import { GraphQL } from '../graphql';
import { centavosDe, diasHasta, filtrarCuentas, vencimientoDe, VistaCuentas, type CuentaFila } from './cuentas';

const HOY = new Date(2026, 10, 3, 10, 0); // 03/11/2026 a las 10:00
const dia = (d: number, hora = 12) => new Date(2026, 10, d, hora, 0).toISOString();

const cuenta = (codigo: string, cambios: Partial<CuentaFila> = {}): CuentaFila => ({
  id: `c-${codigo}`,
  pedidoId: `p-${codigo}`,
  codigo,
  tienda: { id: 'dr', nombre: 'Tienda Doña Rosa' },
  origen: 'CREDITO',
  monto: { centavos: 120_000 },
  pagado: { centavos: 0 },
  saldo: { centavos: 120_000 },
  estado: 'PENDIENTE',
  abiertaEn: dia(1),
  venceEn: dia(16),
  diasDeAtraso: 0,
  pagos: [],
  ...cambios,
});

const CUENTAS: CuentaFila[] = [
  cuenta('A-0998', { venceEn: dia(1), diasDeAtraso: 2, pagado: { centavos: 20_000 }, saldo: { centavos: 100_000 }, estado: 'PARCIAL' }),
  cuenta('A-1019', { tienda: { id: 'sj', nombre: 'Tienda San Juan' }, venceEn: dia(4) }),
  cuenta('A-1012', { tienda: { id: 'ec', nombre: 'Minimarket El Cruce' } }),
  cuenta('A-1031', { origen: 'CONTRA_ENTREGA', venceEn: null, monto: { centavos: 57_500 }, saldo: { centavos: 57_500 } }),
  cuenta('A-0900', { estado: 'PAGADA', saldo: { centavos: 0 }, pagado: { centavos: 120_000 } }),
];

describe('Cuentas por cobrar (CU-09)', () => {
  it('el vencimiento se dice en palabras y con el color de su urgencia', () => {
    expect(vencimientoDe(CUENTAS[0], HOY)).toEqual({ texto: 'Venció hace 2 días', clase: 'error' });
    expect(vencimientoDe(cuenta('x', { venceEn: dia(2) }), HOY)).toEqual({ texto: 'Venció ayer', clase: 'error' });
    expect(vencimientoDe(cuenta('x', { venceEn: dia(3, 23) }), HOY)).toEqual({ texto: 'Vence hoy', clase: 'error' });
    expect(vencimientoDe(cuenta('x', { venceEn: dia(4, 1) }), HOY)).toEqual({ texto: 'Vence mañana', clase: 'advertencia' });
    expect(vencimientoDe(cuenta('x', { venceEn: dia(8) }), HOY)).toEqual({ texto: 'Vence en 5 días', clase: 'advertencia' });
    expect(vencimientoDe(CUENTAS[2], HOY)).toEqual({ texto: 'Vence el 16/11', clase: 'lima' });
    expect(vencimientoDe(CUENTAS[3], HOY).texto).toBe('Cobra al entregar');
    expect(vencimientoDe(CUENTAS[4], HOY).texto).toBe('Pagada');
    expect(diasHasta(dia(4, 0), HOY)).toBe(1); // mañana temprano sigue siendo «mañana»
  });

  it('filtra por vencidas, por vencer en 7 días, contra entrega y pagadas; y busca por tienda o código', () => {
    const codigos = (l: CuentaFila[]) => l.map((c) => c.codigo);
    expect(codigos(filtrarCuentas(CUENTAS, 'todas', '', HOY))).toEqual(['A-0998', 'A-1019', 'A-1012', 'A-1031']);
    expect(codigos(filtrarCuentas(CUENTAS, 'vencidas', '', HOY))).toEqual(['A-0998']);
    expect(codigos(filtrarCuentas(CUENTAS, 'por-vencer', '', HOY))).toEqual(['A-1019']);
    expect(codigos(filtrarCuentas(CUENTAS, 'contra-entrega', '', HOY))).toEqual(['A-1031']);
    expect(codigos(filtrarCuentas(CUENTAS, 'pagadas', '', HOY))).toEqual(['A-0900']);
    expect(codigos(filtrarCuentas(CUENTAS, 'todas', 'cruce', HOY))).toEqual(['A-1012']);
    expect(codigos(filtrarCuentas(CUENTAS, 'todas', 'a-1019', HOY))).toEqual(['A-1019']);
  });

  it('el monto se escribe como en Bolivia: coma para los centavos y punto para los miles', () => {
    expect(centavosDe('150')).toBe(15_000);
    expect(centavosDe('150,5')).toBe(15_050);
    expect(centavosDe('1.200,50')).toBe(120_050);
    expect(centavosDe('1.200')).toBe(120_000);
    expect(centavosDe('1200.50')).toBe(120_050);
    expect(centavosDe('Bs 85')).toBe(8_500);
    expect(centavosDe('')).toBeNull();
    expect(centavosDe('doce')).toBeNull();
    expect(centavosDe('1,234,5')).toBeNull();
  });

  it('muestra lo que deben, lo más atrasado primero, y registra un pago con su id', async () => {
    const llamadas: { query: string; variables: Record<string, unknown> }[] = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: GraphQL,
          useValue: {
            consultar: async (query: string, variables: Record<string, unknown> = {}) => {
              llamadas.push({ query, variables });
              if (query.includes('registrarPago')) return { registrarPago: { ...CUENTAS[1], estado: 'PARCIAL', saldo: { centavos: 70_000 } } };
              return { cuentasPorCobrar: { porCobrar: { centavos: 397_500 }, vencido: { centavos: 100_000 }, tiendas: 3, cuentas: CUENTAS.slice(0, 4) } };
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(VistaCuentas);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const raiz = (fixture.nativeElement as HTMLElement).shadowRoot ?? (fixture.nativeElement as HTMLElement);
    const texto = raiz.textContent ?? '';
    expect(texto).toContain('Bs 3.975,00');
    expect(texto).toContain('Bs 1.000,00');
    expect(texto).toContain('3 tiendas te deben');
    expect(texto).toContain('Tienda Doña Rosa');
    expect(texto).toContain('Cobra al entregar');

    const vista = fixture.componentInstance;
    vista.abrir(CUENTAS[1]);
    vista.monto.set('500');
    vista.forma.set('TRANSFERENCIA');
    await vista.registrar(CUENTAS[1]);
    const pago = llamadas.find((l) => l.query.includes('registrarPago'));
    expect(pago?.variables['entrada']).toMatchObject({ pedidoId: 'p-A-1019', centavos: 50_000, forma: 'TRANSFERENCIA', nota: null });
    expect(String((pago?.variables['entrada'] as { pagoId: string }).pagoId)).toMatch(/.{8,}/);
    expect(vista.abierta()).toBeNull();
  });

  it('no deja cobrar más de lo que debe', () => {
    TestBed.configureTestingModule({ providers: [{ provide: GraphQL, useValue: { consultar: async () => ({ cuentasPorCobrar: null }) } }] });
    const vista = TestBed.createComponent(VistaCuentas).componentInstance;
    vista.monto.set('1.500');
    expect(vista.problemaDelMonto(CUENTAS[1])).toBe('Debe Bs 1.200,00: no puedes cobrar más');
    vista.monto.set('tres');
    expect(vista.problemaDelMonto(CUENTAS[1])).toBe('Escribe el monto así: 150 o 150,50');
  });
});
