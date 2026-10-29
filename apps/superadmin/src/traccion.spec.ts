import { describe, expect, it } from 'vitest';
import { alturas, crecimiento, recompra, semana } from './traccion';

const s = (desde: string, centavos: number) => ({ desde, pedidos: centavos ? 1 : 0, ventas: { centavos, texto: '' } });

describe('Tracción', () => {
  it('las barras se miden contra la mejor semana', () => {
    expect(alturas([s('2026-10-12', 0), s('2026-10-19', 5000), s('2026-10-26', 10000)])).toEqual([0, 50, 100]);
    expect(alturas([s('2026-10-26', 0)])).toEqual([0]);
  });

  it('la recompra es el porcentaje de tiendas que pidieron dos veces o más', () => {
    const tiendas = [1, 2, 3, 4].map((i) => ({ tienda: { id: `t${i}` }, pedidos: 1, ventas: { texto: '' } }));
    expect(recompra({ tiendas, tiendasQueRepiten: 1 })).toBe('25 %');
    expect(recompra({ tiendas: [], tiendasQueRepiten: 0 })).toBe('—');
  });

  it('el crecimiento compara las dos últimas semanas completas', () => {
    expect(crecimiento([s('2026-10-12', 10000), s('2026-10-19', 15000), s('2026-10-26', 100)])).toBe('+50 %');
    expect(crecimiento([s('2026-10-12', 0), s('2026-10-19', 15000), s('2026-10-26', 0)])).toBe('nueva venta');
    expect(crecimiento([s('2026-10-26', 1)])).toBeNull();
  });

  it('cada semana se rotula por su lunes', () => {
    expect(semana('2026-10-26')).toBe('26/10');
  });
});
