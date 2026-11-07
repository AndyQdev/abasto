import { EJEMPLOS, ModeloSimulado } from '../../infraestructura/modelos/modelo.simulado.js';
import { validarConsulta } from '../dominio/guardia-sql.js';
import { PreguntaNoEntendida, type AuditoriaDeConsultas, type ConsultorDeReportes, type RegistroDeAuditoria } from '../puertos.js';
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

  it('todas las consultas del simulado pasan la guardia de SQL', async () => {
    for (const pregunta of [...EJEMPLOS, '¿Qué pedidos se rechazaron?', '¿Cómo compran mis tiendas?', 'demanda prevista', 'lo más vendido', 'mis pedidos', 'sin stock']) {
      const { sql } = await new ModeloSimulado().generarConsulta(pregunta);
      expect({ pregunta, ok: validarConsulta(sql).ok }).toEqual({ pregunta, ok: true });
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

describe('ConsultarReportes', () => {
  it('una consulta peligrosa no llega a la base y queda registrada como rechazada', async () => {
    const { reportes, registros, ejecutadas } = preparar();
    await expect(reportes.ejecutar('DROP TABLE ventas_diarias', solicitante, 'mcp')).rejects.toThrow(ConsultaRechazada);
    expect(ejecutadas).toEqual([]);
    expect(registros[0]).toMatchObject({ origen: 'mcp', resultado: 'rechazada' });
  });
});
