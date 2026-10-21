import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { LIMITE_DE_FILAS } from '../../reportes/dominio/guardia-sql.js';
import type { ConsultorDeReportes, ResultadoDeConsulta, Solicitante } from '../../reportes/puertos.js';
import { POOL_LECTOR } from './conexiones.js';

const ORG_VALIDA = /^[a-z0-9_-]{1,40}$/;

/**
 * Ejecuta como mcp_lector. Aunque la guardia fallara, aquí siguen tres barreras:
 * transacción READ ONLY, statement_timeout de 5 s y la política de seguridad por fila,
 * que solo deja ver las filas del org_id de la sesión.
 */
@Injectable()
export class ConsultorPostgres implements ConsultorDeReportes {
  constructor(@Inject(POOL_LECTOR) private readonly pool: pg.Pool) {}

  async consultar(sql: string, solicitante: Solicitante): Promise<ResultadoDeConsulta> {
    if (!ORG_VALIDA.test(solicitante.orgId)) throw new Error('La sesión no tiene una empresa válida');
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN READ ONLY');
      await cliente.query("SET LOCAL statement_timeout = '5s'");
      // SET no admite parámetros; el org_id ya se validó con la expresión de arriba
      await cliente.query(`SET LOCAL abasto.org_id = '${solicitante.orgId}'`);
      // Un cursor respeta el ORDER BY de la consulta y trae como máximo 1.001 filas
      await cliente.query(`DECLARE consulta NO SCROLL CURSOR FOR ${sql}`);
      const r = await cliente.query(`FETCH ${LIMITE_DE_FILAS + 1} FROM consulta`);
      return {
        columnas: r.fields.map((f) => f.name),
        filas: r.rows.slice(0, LIMITE_DE_FILAS),
        truncado: r.rows.length > LIMITE_DE_FILAS,
      };
    } finally {
      await cliente.query('ROLLBACK').catch(() => undefined);
      cliente.release();
    }
  }
}
