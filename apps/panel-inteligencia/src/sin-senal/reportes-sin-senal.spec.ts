import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buscarGuardado,
  encolarPregunta,
  guardarReporte,
  MAXIMO_GUARDADOS,
  normalizarPregunta,
  preguntasPendientes,
  reportesGuardados,
} from './reportes-sin-senal';

const reporte = (pregunta: string, filas = 1) => ({
  pregunta,
  sql: 'SELECT 1',
  explicacion: '',
  grafico: 'tabla',
  columnas: ['n'],
  filas: Array.from({ length: filas }, (_, n) => ({ n })),
  truncado: false,
  modelo: 'simulado',
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Reportes guardados en el equipo', () => {
  it('la misma pregunta con otras tildes o signos es la misma', () => {
    expect(normalizarPregunta('¿Qué tiendas me DEBEN?')).toBe(normalizarPregunta('que tiendas  me deben'));
  });

  it('guarda los últimos 10, sin repetir la misma pregunta, y recorta las filas grandes', () => {
    for (let i = 0; i < 12; i++) guardarReporte('lp', reporte(`pregunta ${i}`));
    guardarReporte('lp', reporte('¿Pregunta 11?', 500));
    const guardados = reportesGuardados('lp');
    expect(guardados).toHaveLength(MAXIMO_GUARDADOS);
    expect(guardados[0].pregunta).toBe('¿Pregunta 11?');
    expect(guardados.filter((g) => normalizarPregunta(g.pregunta) === 'pregunta 11')).toHaveLength(1);
    expect(buscarGuardado('lp', 'pregunta 11')?.filas).toHaveLength(200);
    expect(buscarGuardado('lp', 'pregunta 11')?.truncado).toBe(true);
    // Cada empresa ve solo lo suyo
    expect(reportesGuardados('lr')).toEqual([]);
  });

  it('una pregunta encolada dos veces queda una sola vez', () => {
    encolarPregunta('lp', 'cuánto me deben');
    encolarPregunta('lp', '¿Cuánto me deben?');
    expect(preguntasPendientes('lp')).toEqual(['¿Cuánto me deben?']);
  });

  it('si el navegador no deja guardar (modo privado), sigue sin romperse', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => guardarReporte('lp', reporte('x'))).not.toThrow();
    expect(reportesGuardados('lp')).toEqual([]);
  });
});
