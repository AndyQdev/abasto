import { describe, expect, it } from 'vitest';
import { encabezado, formatearCelda } from './sesion';

describe('Celdas de los reportes', () => {
  it('los centavos se muestran en bolivianos', () => {
    expect(formatearCelda('saldo_centavos', 120000)).toBe('Bs 1.200,00');
    expect(encabezado('saldo_centavos')).toBe('Saldo');
  });

  it('las fechas van en dd/mm/aaaa', () => {
    expect(formatearCelda('vence', '2026-10-21')).toBe('21/10/2026');
  });

  it('un valor vacío se ve como raya', () => {
    expect(formatearCelda('nombre', null)).toBe('—');
  });
});
