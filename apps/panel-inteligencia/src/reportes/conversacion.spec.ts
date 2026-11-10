import { afterEach, describe, expect, it } from 'vitest';
import {
  bloquesDe,
  cargarConversacion,
  hojasDe,
  kpisDe,
  porcionesDe,
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

describe('Vista de varios bloques (10/11)', () => {
  const bloque = (parcial: Partial<NonNullable<Reporte['bloques']>[number]>) => ({
    titulo: 'b', sql: 'SELECT 1', plantilla: 'tabla' as const, pedida: 'tabla' as const, alternativas: ['tabla' as const],
    columnas: [], filas: [], truncado: false, ...parcial,
  });

  it('los KPIs comparan con su «_anterior» y no lo muestran como otra tarjeta', () => {
    const kpis = kpisDe({ columnas: ['ventas_centavos', 'ventas_centavos_anterior', 'pedidos', 'pedidos_anterior'], filas: [{ ventas_centavos: '120000', ventas_centavos_anterior: '100000', pedidos: 8, pedidos_anterior: 10 }] });
    expect(kpis.map((k) => k.etiqueta)).toEqual(['Ventas', 'Pedidos']);
    expect(kpis[0]).toMatchObject({ valor: 'Bs 1.200,00', variacion: { texto: '+20,0 %', sentido: 'sube', antes: 'antes Bs 1.000,00' } });
    expect(kpis[1].variacion).toMatchObject({ texto: '-20,0 %', sentido: 'baja' });
  });

  it('una dona de más de 6 partes junta las chicas en «Otros»', () => {
    const filas = Array.from({ length: 8 }, (_, i) => ({ tienda_nombre: `T${i}`, total_centavos: String((8 - i) * 100) }));
    const p = porcionesDe({ columnas: ['tienda_nombre', 'total_centavos'], filas }, 'tienda_nombre', 'total_centavos');
    expect(p).toHaveLength(6);
    expect(p.at(-1)).toMatchObject({ etiqueta: 'Otros', otros: true, valor: 600 });
    expect(Math.round(p.reduce((s2, x) => s2 + x.porciento, 0))).toBe(100);
  });

  it('un reporte de antes (sin bloques) se ve como un solo bloque', () => {
    const r = reporte({ columnas: ['tienda_nombre', 'saldo_centavos'], filas: [{ tienda_nombre: 'A', saldo_centavos: '100' }, { tienda_nombre: 'B', saldo_centavos: '50' }], grafico: 'barras' });
    expect(bloquesDe(r)).toEqual([expect.objectContaining({ plantilla: 'barras', alternativas: ['barras', 'tabla'], filas: r.filas })]);
  });

  it('la pestaña de una vista lleva su ícono, y el Excel una hoja por bloque con datos', () => {
    const r = reporte({
      columnas: ['a'], filas: [{ a: 1 }],
      bloques: [bloque({ titulo: 'Uno', plantilla: 'kpis', columnas: ['a'], filas: [{ a: 1 }] }), bloque({ titulo: 'Vacío' }), bloque({ titulo: 'Dos', plantilla: 'dona', columnas: ['b'], filas: [{ b: 2 }] })],
    });
    expect(plantillaDe(r)).toBe('vista');
    expect(hojasDe(r).map((h) => h.titulo)).toEqual(['Uno', 'Dos']);
  });
});
