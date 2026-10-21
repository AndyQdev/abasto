import { ModeloSimulado } from '../../infraestructura/modelos/modelo.simulado.js';
import type { AuditoriaDeConsultas, ConsultorDeReportes, RegistroDeAuditoria } from '../puertos.js';
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
