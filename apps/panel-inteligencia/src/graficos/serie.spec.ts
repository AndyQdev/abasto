import { describe, expect, it } from 'vitest';
import { armarSerie, MAXIMO_DE_BARRAS } from './serie';

describe('Serie del gráfico', () => {
  it('usa el texto como etiqueta y prefiere el monto sobre otras columnas numéricas', () => {
    const serie = armarSerie(
      ['tienda_nombre', 'pedidos', 'saldo_centavos'],
      [{ tienda_nombre: 'Tienda Doña Rosa', pedidos: 3, saldo_centavos: '120000' }],
      'barras',
    );

    expect(serie).toEqual({
      columnaEtiqueta: 'tienda_nombre',
      columnaValor: 'saldo_centavos',
      puntos: [{ etiqueta: 'Tienda Doña Rosa', valor: 120000 }],
    });
  });

  it('con código y nombre, las barras llevan el nombre', () => {
    const serie = armarSerie(
      ['tienda_id', 'tienda_nombre', 'deuda_total_centavos'],
      [{ tienda_id: 'ec', tienda_nombre: 'Minimarket El Cruce', deuda_total_centavos: '133000' }],
      'barras',
    );
    expect(serie?.columnaEtiqueta).toBe('tienda_nombre');
    expect(armarSerie(['producto_id', 'fecha', 'unidades'], [{ producto_id: 'HD-0050', fecha: '2026-11-09', unidades: 3 }], 'linea')?.columnaEtiqueta).toBe('fecha');
  });

  it('en una línea respeta el orden de las fechas', () => {
    const serie = armarSerie(
      ['fecha', 'total_centavos'],
      [
        { fecha: '2026-10-01', total_centavos: 5 },
        { fecha: '2026-10-02', total_centavos: 9 },
      ],
      'linea',
    );

    expect(serie?.puntos.map((p) => p.etiqueta)).toEqual(['2026-10-01', '2026-10-02']);
  });

  it('con muchas barras muestra solo las mayores', () => {
    const filas = Array.from({ length: 20 }, (_, i) => ({ nombre: `P${i}`, stock: i }));
    const serie = armarSerie(['nombre', 'stock'], filas, 'barras');

    expect(serie?.puntos).toHaveLength(MAXIMO_DE_BARRAS);
    expect(serie?.puntos[0]).toEqual({ etiqueta: 'P19', valor: 19 });
  });

  it.each([
    ['si el modelo pidió tabla', ['nombre', 'stock'], [{ nombre: 'a', stock: 1 }], 'tabla'],
    ['sin filas', ['nombre', 'stock'], [], 'barras'],
    ['sin columna numérica', ['nombre', 'ciudad'], [{ nombre: 'a', ciudad: 'b' }], 'barras'],
    ['sin columna de etiquetas', ['pedidos', 'total_centavos'], [{ pedidos: 1, total_centavos: 2 }], 'barras'],
  ])('no hay gráfico %s', (_, columnas, filas, tipo) => {
    expect(armarSerie(columnas as string[], filas as Record<string, unknown>[], tipo as string)).toBeNull();
  });
});
