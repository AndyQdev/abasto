import { EJEMPLOS, ModeloSimulado } from '../../infraestructura/modelos/modelo.simulado.js';
import { validarConsulta } from '../dominio/guardia-sql.js';
import { PreguntaNoEntendida, type AuditoriaDeConsultas, type ConsultorDeReportes, type ModeloDeLenguaje, type RegistroDeAuditoria } from '../puertos.js';
import { ConsultaRechazada, ConsultarReportes } from './consultar-reportes.js';
import { ResponderPregunta } from './responder-pregunta.js';

const preparar = () => {
  const registros: RegistroDeAuditoria[] = [];
  const ejecutadas: string[] = [];
  const consultor: ConsultorDeReportes = {
    consultar: async (sql) => {
      ejecutadas.push(sql);
      return { columnas: ['tienda_nombre'], filas: [{ tienda_nombre: 'Tienda Doña Rosa' }], truncado: false };
    },
  };
  const auditoria: AuditoriaDeConsultas = { registrar: async (r) => void registros.push(r) };
  const reportes = new ConsultarReportes(consultor, auditoria);
  return { reportes, registros, ejecutadas, responder: new ResponderPregunta(new ModeloSimulado(), reportes) };
};

const solicitante = { usuarioId: 'u1', orgId: 'lp' };

describe('ResponderPregunta', () => {
  it('entiende la pregunta aunque llegue sin tildes, como a veces la transcribe la voz', async () => {
    const { responder } = preparar();
    const r = await responder.ejecutar('que tiendas me tienen que pagar MANANA', solicitante);
    expect(r.sql).toContain('cuentas_por_cobrar');
  });

  it.each(['¿Cuánto me debe cada tienda?', '¿Qué tiendas me deben?'])('entiende la deuda en singular y en plural: %s', async (pregunta) => {
    const { responder } = preparar();
    const r = await responder.ejecutar(pregunta, solicitante);
    expect(r.sql).toContain('sum(saldo_centavos)');
    expect(r.grafico).toBe('barras');
  });

  it('si no reconoce la pregunta dice «no entendí» con ejemplos, y no corre ninguna consulta', async () => {
    const { responder, ejecutadas } = preparar();
    const error = await responder.ejecutar('¿Cuál es la capital de Francia?', solicitante).catch((e) => e);
    expect(error).toBeInstanceOf(PreguntaNoEntendida);
    expect((error as PreguntaNoEntendida).ejemplos).toContain('¿Qué tiendas me tienen que pagar mañana?');
    expect(ejecutadas).toEqual([]);
  });

  it.each([
    ['¿Qué tiendas tienen más riesgo de pagar tarde?', 'riesgo_mora'],
    ['¿Qué productos están sin stock?', 'stock = 0'],
    ['¿Qué productos se me acaban?', 'dias_de_stock'],
    ['¿Cuánto voy a vender la próxima semana?', 'prediccion_demanda'],
    ['¿Qué es lo que más se vende?', 'unidades_mes'],
    ['¿Qué pedidos se rechazaron?', "estado = 'RECHAZADO'"],
    ['¿Cómo compran mis tiendas?', 'segmento_tiendas'],
    ['Muéstrame mis últimos pedidos', 'FROM pedidos'],
    ['¿Cuánto vendí este mes?', 'ventas_diarias'],
  ])('reconoce «%s»', async (pregunta, sql) => {
    const { responder } = preparar();
    expect((await responder.ejecutar(pregunta, solicitante)).sql).toContain(sql);
  });

  it('todas las consultas del simulado pasan la guardia de SQL, también las de cada bloque', async () => {
    const preguntas = [...EJEMPLOS, '¿Qué pedidos se rechazaron?', '¿Cómo compran mis tiendas?', 'demanda prevista', 'lo más vendido', 'mis pedidos', 'sin stock', '¿Cómo va mi negocio?', '¿Cómo me pagan?'];
    for (const pregunta of preguntas) {
      const consulta = await new ModeloSimulado().generarConsulta(pregunta);
      for (const sql of [consulta.sql, ...(consulta.bloques ?? []).map((b) => b.sql)]) {
        const v = validarConsulta(sql);
        expect({ pregunta, sql: sql.slice(0, 60), motivo: v.ok ? null : v.motivo }).toEqual({ pregunta, sql: sql.slice(0, 60), motivo: null });
      }
    }
  });

  it('convierte la pregunta en SQL, la ejecuta y la audita', async () => {
    const { responder, registros } = preparar();
    const r = await responder.ejecutar('¿Qué tiendas me tienen que pagar mañana?', solicitante);
    expect(r.sql).toContain('cuentas_por_cobrar');
    expect(r.filas).toEqual([{ tienda_nombre: 'Tienda Doña Rosa' }]);
    expect(registros).toEqual([expect.objectContaining({ origen: 'analista', resultado: 'ok', orgId: 'lp' })]);
  });
});

describe('ResponderPregunta arma una vista de varios bloques', () => {
  /** Responde según la tabla de cada consulta, como lo haría la base. */
  const consultorPorTabla = (falla?: RegExp): ConsultorDeReportes => ({
    consultar: async (sql) => {
      if (falla?.test(sql)) throw new Error('canceling statement due to statement timeout');
      if (/AS ventas_centavos_anterior/.test(sql)) return { columnas: ['ventas_centavos', 'ventas_centavos_anterior'], filas: [{ ventas_centavos: '120000', ventas_centavos_anterior: '100000' }], truncado: false };
      if (/metodo_pago/.test(sql)) {
        const filas = [{ metodo_pago: 'qr', total_centavos: '700' }, { metodo_pago: 'credito', total_centavos: '300' }];
        return { columnas: ['metodo_pago', 'total_centavos'], filas, truncado: false };
      }
      if (/ventas_por_producto/.test(sql)) {
        const filas = Array.from({ length: 10 }, (_, i) => ({ producto_nombre: `P${i}`, ventas_centavos: String(1000 - i) }));
        return { columnas: ['producto_nombre', 'ventas_centavos'], filas, truncado: false };
      }
      return { columnas: ['semana', 'ventas_centavos'], filas: [{ semana: '2026-10-05', ventas_centavos: '1' }], truncado: false };
    },
  });
  const con = (consultor: ConsultorDeReportes, modelo: ModeloDeLenguaje = new ModeloSimulado()) =>
    new ResponderPregunta(modelo, new ConsultarReportes(consultor, { registrar: async () => undefined }));

  it('«¿cómo va mi negocio?» es un diagnóstico: KPIs, línea, barras, dona y tabla, no una pregunta de vuelta', async () => {
    const r = await con(consultorPorTabla()).ejecutar('¿Cómo va mi negocio?', solicitante);
    expect(r.bloques.map((b) => b.pedida)).toEqual(['kpis', 'linea', 'barras', 'dona', 'tabla']);
    expect(r.bloques[0]).toMatchObject({ plantilla: 'kpis', titulo: 'Últimos 30 días' });
    expect(r.bloques[3]).toMatchObject({ plantilla: 'dona', alternativas: ['barras', 'dona', 'tabla'] });
    // Arriba, el primer bloque como antes: lo de siempre (Excel, evaluar, lo guardado sin señal) sigue andando
    expect(r.filas).toEqual(r.bloques[0].filas);
    expect(r.grafico).toBe('tabla');
  });

  it('si los datos no encajan en la plantilla, usa la siguiente que sí y dice por qué', async () => {
    const r = await con(consultorPorTabla()).ejecutar('¿Cómo va mi negocio?', solicitante);
    // La línea volvió con un solo punto: no se puede dibujar como línea
    expect(r.bloques[1]).toMatchObject({ pedida: 'linea', plantilla: 'barras', aviso: expect.stringMatching(/3 puntos/) });
  });

  it('si falla un bloque de contexto, el reporte sale sin él', async () => {
    const r = await con(consultorPorTabla(/metodo_pago/)).ejecutar('¿Cómo va mi negocio?', solicitante);
    expect(r.bloques.map((b) => b.titulo)).not.toContain('Cómo te pagan');
    expect(r.bloques).toHaveLength(4);
  });

  it('si el bloque que responde la pregunta falla en la base, le pide al modelo que lo corrija una vez', async () => {
    const simulado = new ModeloSimulado();
    const pedidas: string[] = [];
    const corrige: ModeloDeLenguaje = {
      nombre: 'prueba',
      generarConsulta: async (p) => {
        pedidas.push(p);
        // La primera vez escribe un SQL que la base no entiende; con el error, lo arregla
        if (pedidas.length === 1) return { sql: 'SELECT fecha - total_centavos FROM ventas_diarias', explicacion: 'x', grafico: 'tabla' };
        return simulado.generarConsulta('¿Cómo va mi negocio?');
      },
    };
    const r = await con(consultorPorTabla(/fecha - total_centavos/), corrige).ejecutar('¿Cómo va mi negocio?', solicitante);
    expect(pedidas).toHaveLength(2);
    expect(pedidas[1]).toContain('statement timeout');
    expect(pedidas[1]).toContain('SELECT fecha - total_centavos');
    expect(r.bloques).toHaveLength(5);
  });

  it('si después de corregir sigue fallando, lo dice claro (no un error 500)', async () => {
    const error = await con(consultorPorTabla(/AS ventas_centavos_anterior/)).ejecutar('¿Cómo va mi negocio?', solicitante).catch((e) => e);
    expect(error).toBeInstanceOf(ConsultaRechazada);
    expect((error as ConsultaRechazada).motivo).toMatch(/falló en la base/);
  });

  it('el modelo lee los resultados con los montos en bolivianos; si la lectura falla, el reporte sale igual', async () => {
    const leidos: unknown[] = [];
    const simulado = new ModeloSimulado();
    const lee: ModeloDeLenguaje = {
      nombre: 'prueba',
      generarConsulta: (p) => simulado.generarConsulta(p),
      leerResultados: async (_p, bloques) => {
        leidos.push(...bloques);
        return { hallazgos: ['Vendiste Bs 1.200,00, 20 % más que antes.'], recomendaciones: [] };
      },
    };
    const r = await con(consultorPorTabla(), lee).ejecutar('¿Cómo va mi negocio?', solicitante);
    expect(r.lectura).toEqual({ hallazgos: ['Vendiste Bs 1.200,00, 20 % más que antes.'], recomendaciones: [] });
    expect(leidos[0]).toEqual({ titulo: 'Últimos 30 días', columnas: ['ventas_bs', 'ventas_bs_anterior'], filas: [{ ventas_bs: 1200, ventas_bs_anterior: 1000 }] });

    const falla = { ...lee, leerResultados: async () => Promise.reject(new Error('504')) };
    const sinLectura = await con(consultorPorTabla(), falla).ejecutar('¿Cómo va mi negocio?', solicitante);
    expect(sinLectura.lectura).toBeNull();
    expect(sinLectura.bloques).toHaveLength(5);
  });

  it('una respuesta de un solo SQL (sin bloques) sigue siendo un bloque', async () => {
    const r = await con(consultorPorTabla()).ejecutar('¿Qué tiendas me tienen que pagar mañana?', solicitante);
    expect(r.bloques).toHaveLength(1);
    expect(r.bloques[0]).toMatchObject({ pedida: 'tabla', sql: r.sql });
    expect(r.lectura).toBeNull(); // el simulado no lee
  });
});

describe('ConsultarReportes', () => {
  it('una consulta peligrosa no llega a la base y queda registrada como rechazada', async () => {
    const { reportes, registros, ejecutadas } = preparar();
    await expect(reportes.ejecutar('DROP TABLE ventas_diarias', solicitante, 'mcp')).rejects.toThrow(ConsultaRechazada);
    expect(ejecutadas).toEqual([]);
    expect(registros[0]).toMatchObject({ origen: 'mcp', resultado: 'rechazada' });
  });
});
