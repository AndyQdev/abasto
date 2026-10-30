import { describe, expect, it } from 'vitest';
import { MAXIMO_DE_BARRAS } from '../graficos/serie';
import {
  DIAS_CRITICOS,
  productosEnRiesgo,
  serieDeDemanda,
  serieDeSegmentos,
  serieDeVentas,
  textoDeDias,
  totalDeVentas,
  type Tableros,
} from './tableros';

const demanda: Tableros['demanda'] = [
  { producto_id: 'arroz', nombre: 'Arroz', stock: 10, unidades_semana: 40, dias_de_stock: 3 },
  { producto_id: 'aceite', nombre: 'Aceite', stock: 5, unidades_semana: 20, dias_de_stock: 1 },
  { producto_id: 'nuez', nombre: 'Nuez', stock: 8, unidades_semana: 16, dias_de_stock: 3 },
  { producto_id: 'sal', nombre: 'Sal', stock: 50, unidades_semana: 10, dias_de_stock: null },
  { producto_id: 'azucar', nombre: 'Azúcar', stock: 90, unidades_semana: 10, dias_de_stock: DIAS_CRITICOS },
];

describe('Tableros', () => {
  describe('productosEnRiesgo', () => {
    it('deja solo los que se agotan antes del límite, los más urgentes primero, sin mutar la entrada', () => {
      const copia = structuredClone(demanda);

      const riesgo = productosEnRiesgo(demanda);

      expect(riesgo.map((p) => p.producto_id)).toEqual(['aceite', 'arroz', 'nuez']);
      expect(demanda).toEqual(copia);
    });

    it('empata por nombre en español', () => {
      const riesgo = productosEnRiesgo(demanda);

      expect(riesgo.map((p) => p.nombre)).toEqual(['Aceite', 'Arroz', 'Nuez']);
    });

    it('respeta otro límite de días', () => {
      expect(productosEnRiesgo(demanda, 2).map((p) => p.producto_id)).toEqual(['aceite']);
    });
  });

  it('serieDeVentas conserva el orden de los días y usa los centavos como valor', () => {
    const serie = serieDeVentas([
      { fecha: '2026-10-28', total_centavos: 150000 },
      { fecha: '2026-10-29', total_centavos: 250000 },
    ]);

    expect(serie).toEqual({
      columnaEtiqueta: 'fecha',
      columnaValor: 'total_centavos',
      puntos: [
        { etiqueta: '2026-10-28', valor: 150000 },
        { etiqueta: '2026-10-29', valor: 250000 },
      ],
    });
  });

  it('serieDeSegmentos ordena de más a menos tiendas', () => {
    const serie = serieDeSegmentos([
      { segmento: 'Ocasionales', tiendas: 12, compras_mes: 1, ticket_promedio_centavos: 50000 },
      { segmento: 'Frecuentes', tiendas: 30, compras_mes: 4, ticket_promedio_centavos: 90000 },
    ]);

    expect(serie.columnaEtiqueta).toBe('segmento');
    expect(serie.columnaValor).toBe('tiendas');
    expect(serie.puntos).toEqual([
      { etiqueta: 'Frecuentes', valor: 30 },
      { etiqueta: 'Ocasionales', valor: 12 },
    ]);
  });

  it('serieDeDemanda se queda con las barras que se leen, de mayor a menor', () => {
    const muchaDemanda = Array.from({ length: MAXIMO_DE_BARRAS + 3 }, (_, i) => ({
      producto_id: `p${i}`,
      nombre: `Producto ${i}`,
      stock: 10,
      unidades_semana: i,
      dias_de_stock: 5,
    }));

    const serie = serieDeDemanda(muchaDemanda);

    expect(serie.columnaEtiqueta).toBe('nombre');
    expect(serie.columnaValor).toBe('unidades_semana');
    expect(serie.puntos).toHaveLength(MAXIMO_DE_BARRAS);
    expect(serie.puntos[0]).toEqual({ etiqueta: `Producto ${MAXIMO_DE_BARRAS + 2}`, valor: MAXIMO_DE_BARRAS + 2 });
  });

  it('totalDeVentas suma los centavos de cada día', () => {
    expect(totalDeVentas([{ fecha: '2026-10-28', total_centavos: 150000 }, { fecha: '2026-10-29', total_centavos: 250000 }])).toBe(400000);
    expect(totalDeVentas([])).toBe(0);
  });

  it.each([
    [null, 'Sin demanda prevista'],
    [0, 'Sin stock'],
    [0.4, 'Menos de 1 día'],
    [1, '1 día'],
    [3.9, '3 días'],
  ])('textoDeDias(%s) dice «%s»', (dias, texto) => {
    expect(textoDeDias(dias)).toBe(texto);
  });
});
