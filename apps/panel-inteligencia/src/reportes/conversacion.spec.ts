import { afterEach, describe, expect, it } from 'vitest';
import {
  cargarConversacion,
  guardarConversacion,
  numerosDe,
  plantillaDe,
  resumenDe,
  tituloCorto,
  type Reporte,
} from './conversacion';

const reporte = (parcial: Partial<Reporte>): Reporte => ({
  id: 'r',
  hora: '2026-11-09T14:05:00.000Z',
  pregunta: 'p',
  sql: 'SELECT 1',
  explicacion: 'e',
  grafico: 'tabla',
  columnas: [],
  filas: [],
  truncado: false,
  modelo: 'gemini-3.8-flash',
  ...parcial,
});

afterEach(() => sessionStorage.clear());

describe('Qué plantilla usa cada reporte', () => {
  it('una sola fila con números se muestra en grande', () => {
    const r = { columnas: ['total_centavos', 'pedidos'], filas: [{ total_centavos: '4500000', pedidos: 64 }], grafico: 'tabla' };
    expect(plantillaDe(r)).toBe('numeros');
    expect(numerosDe(r)).toEqual([
      { etiqueta: 'Total', valor: 'Bs 45.000,00', detalle: undefined },
      { etiqueta: 'Pedidos', valor: '64', detalle: undefined },
    ]);
  });

  it('el texto de esa fila acompaña a los números', () => {
    const r = { columnas: ['nombre', 'vendidas_por_dia'], filas: [{ nombre: 'Pasta dental 90 g', vendidas_por_dia: 60 }] };
    expect(numerosDe(r)).toEqual([{ etiqueta: 'Vendidas por dia', valor: '60', detalle: 'Pasta dental 90 g' }]);
  });

  it('cuando el Analista no tiene con qué responder, es un aviso; sin filas, vacío', () => {
    expect(plantillaDe({ columnas: ['aviso'], filas: [{ aviso: 'Sin datos para esa pregunta' }], grafico: 'tabla' })).toBe('aviso');
    expect(plantillaDe({ columnas: ['a'], filas: [], grafico: 'barras' })).toBe('vacio');
  });

  it('varias filas siguen el gráfico que eligió el modelo', () => {
    const filas = [{ t: 'a', v: 1 }, { t: 'b', v: 2 }];
    expect(plantillaDe({ columnas: ['t', 'v'], filas, grafico: 'barras' })).toBe('barras');
    expect(plantillaDe({ columnas: ['t', 'v'], filas, grafico: 'linea' })).toBe('linea');
    expect(plantillaDe({ columnas: ['t', 'v'], filas, grafico: 'tabla' })).toBe('tabla');
  });
});

describe('Resumen de un gráfico', () => {
  it('con montos: el total y el mayor', () => {
    const r = {
      columnas: ['tienda_nombre', 'saldo_centavos'],
      filas: [
        { tienda_nombre: 'Tienda Doña Rosa', saldo_centavos: '120000' },
        { tienda_nombre: 'Minimarket El Cruce', saldo_centavos: '133000' },
      ],
    };
    expect(resumenDe(r, 'tienda_nombre', 'saldo_centavos')).toEqual([
      { etiqueta: 'Total', valor: 'Bs 2.530,00', detalle: '2 filas' },
      { etiqueta: 'El mayor', valor: 'Bs 1.330,00', detalle: 'Minimarket El Cruce' },
    ]);
  });

  it('sin montos no suma: un total de promedios no significa nada', () => {
    const r = { columnas: ['nombre', 'vendidas_por_dia'], filas: [{ nombre: 'A', vendidas_por_dia: 60 }, { nombre: 'B', vendidas_por_dia: 42 }] };
    expect(resumenDe(r, 'nombre', 'vendidas_por_dia').map((d) => d.etiqueta)).toEqual(['El mayor']);
  });
});

describe('Pestañas y conversación', () => {
  it('el título de la pestaña es la pregunta, corta', () => {
    expect(tituloCorto('¿qué tiendas me deben más plata?')).toBe('Qué tiendas me deben más plata');
    expect(tituloCorto('¿Cuánto vendí cada semana en los últimos 3 meses?')).toBe('Cuánto vendí cada semana en l…');
  });

  it('la conversación se guarda por empresa, con tope de reportes y de filas', () => {
    const muchas = Array.from({ length: 300 }, (_, i) => ({ n: i }));
    const reportes = Array.from({ length: 10 }, (_, i) => reporte({ id: `r${i}`, columnas: ['n'], filas: muchas }));
    guardarConversacion('lp', { mensajes: [], reportes, activa: 'r0' });

    const vuelta = cargarConversacion('lp');
    expect(vuelta.reportes.map((r) => r.id)).toEqual(['r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9']);
    expect(vuelta.reportes[0].filas).toHaveLength(200);
    expect(vuelta.reportes[0].truncado).toBe(true);
    // La pestaña activa se fue con los viejos: queda la última
    expect(vuelta.activa).toBe('r9');
    expect(cargarConversacion('lr').reportes).toEqual([]);
  });

  it('si lo guardado está roto, empieza de cero', () => {
    sessionStorage.setItem('abasto:inteligencia:conversacion:lp', '{roto');
    expect(cargarConversacion('lp')).toEqual({ mensajes: [], reportes: [], activa: null });
  });
});
