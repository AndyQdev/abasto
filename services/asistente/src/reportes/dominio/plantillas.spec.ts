import { alternativasDe, columnaDeEtiqueta, columnaDeValor, elegirPlantilla, porQueNoEncaja } from './plantillas.js';

const datos = (columnas: string[], filas: Record<string, unknown>[]) => ({ columnas, filas });
const metodos = datos(['metodo_pago', 'total_centavos'], [
  { metodo_pago: 'qr', total_centavos: '120000' },
  { metodo_pago: 'credito', total_centavos: '80000' },
  { metodo_pago: 'contra_entrega', total_centavos: '30000' },
]);

describe('Plantillas de la mesa', () => {
  it('los KPIs son una sola fila con números; el «_anterior» no cuenta como tarjeta', () => {
    const una = datos(['ventas_centavos', 'ventas_centavos_anterior', 'pedidos'], [{ ventas_centavos: '500', ventas_centavos_anterior: '400', pedidos: 3 }]);
    expect(porQueNoEncaja('kpis', una)).toBeNull();
    expect(porQueNoEncaja('kpis', metodos)).toMatch(/una sola fila/);
    expect(columnaDeValor(una)).toBe('ventas_centavos');
  });

  it('una dona necesita de 2 a 8 partes que se puedan sumar', () => {
    expect(porQueNoEncaja('dona', metodos)).toBeNull();
    const muchas = datos(['tienda_nombre', 'saldo_centavos'], Array.from({ length: 12 }, (_, i) => ({ tienda_nombre: `T${i}`, saldo_centavos: 100 })));
    expect(porQueNoEncaja('dona', muchas)).toMatch(/más de 8/);
    const riesgo = datos(['tienda_nombre', 'riesgo_por_ciento'], [{ tienda_nombre: 'A', riesgo_por_ciento: 80 }, { tienda_nombre: 'B', riesgo_por_ciento: 20 }]);
    expect(porQueNoEncaja('dona', riesgo)).toMatch(/porcentaje/);
  });

  it('una línea necesita al menos 3 puntos', () => {
    const dos = datos(['mes', 'total_centavos'], [{ mes: '2026-10-01', total_centavos: 1 }, { mes: '2026-11-01', total_centavos: 2 }]);
    expect(porQueNoEncaja('linea', dos)).toMatch(/3 puntos/);
  });

  it('si no encaja cae en la siguiente que sí, con el motivo', () => {
    const muchas = datos(['tienda_nombre', 'saldo_centavos'], Array.from({ length: 12 }, (_, i) => ({ tienda_nombre: `T${i}`, saldo_centavos: 100 })));
    expect(elegirPlantilla('dona', muchas)).toEqual({ plantilla: 'barras', aviso: expect.stringMatching(/más de 8/) });
    expect(elegirPlantilla('kpis', metodos)).toEqual({ plantilla: 'tabla', aviso: expect.any(String) });
    expect(elegirPlantilla('dona', metodos)).toEqual({ plantilla: 'dona' });
  });

  it('sin filas no es desencaje: se queda la plantilla pedida y la mesa dice que no hay datos', () => {
    expect(elegirPlantilla('dona', datos(['a', 'b'], []))).toEqual({ plantilla: 'dona' });
    expect(alternativasDe(datos(['a', 'b'], []))).toEqual(['tabla']);
  });

  it('«Ver como» ofrece solo las plantillas en las que encajan los datos', () => {
    expect(alternativasDe(metodos)).toEqual(['barras', 'dona', 'tabla']);
  });

  it('nombra cada fila con el nombre antes que con el id', () => {
    expect(columnaDeEtiqueta(datos(['tienda_id', 'tienda_nombre', 'saldo_centavos'], [{ tienda_id: 'ec', tienda_nombre: 'El Cruce', saldo_centavos: '10' }]))).toBe('tienda_nombre');
  });
});
