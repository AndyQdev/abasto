import { validarConsulta } from '../dominio/guardia-sql.js';
import type {
  AuditoriaDeConsultas,
  ConsultorDeReportes,
  RegistroDeAuditoria,
  ResultadoDeConsulta,
  Solicitante,
} from '../puertos.js';

export class ConsultaRechazada extends Error {
  constructor(readonly motivo: string) {
    super(motivo);
  }
}

/**
 * La única puerta a la base de reportes: la usan el Analista, los agentes y el MCP.
 * Valida, ejecuta y deja registro, pase lo que pase.
 */
export class ConsultarReportes {
  constructor(
    private readonly consultor: ConsultorDeReportes,
    private readonly auditoria: AuditoriaDeConsultas,
  ) {}

  async ejecutar(
    sql: string,
    solicitante: Solicitante,
    origen: RegistroDeAuditoria['origen'],
  ): Promise<ResultadoDeConsulta> {
    const base = { orgId: solicitante.orgId, usuarioId: solicitante.usuarioId, origen, sql };
    const validacion = validarConsulta(sql);
    if (!validacion.ok) {
      await this.auditoria.registrar({ ...base, resultado: 'rechazada', motivo: validacion.motivo });
      throw new ConsultaRechazada(validacion.motivo);
    }
    try {
      const resultado = await this.consultor.consultar(validacion.sql, solicitante);
      await this.auditoria.registrar({ ...base, resultado: 'ok', filas: resultado.filas.length });
      return resultado;
    } catch (e) {
      await this.auditoria.registrar({ ...base, resultado: 'error', motivo: (e as Error).message });
      throw e;
    }
  }
}
