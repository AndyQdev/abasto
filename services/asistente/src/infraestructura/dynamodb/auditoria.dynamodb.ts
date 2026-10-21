import { Inject, Injectable } from '@nestjs/common';
import { PutCommand, QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import type { AuditoriaDeConsultas, RegistroDeAuditoria } from '../../reportes/puertos.js';
import { DYNAMODB } from './cliente.js';

/** Tabla `asistente`: PK = AUDITORIA#<org>, SK = <fecha ISO>#<id>. El Superadmin la lee por empresa y fecha. */
@Injectable()
export class AuditoriaDynamoDB implements AuditoriaDeConsultas {
  private readonly tabla = process.env.TABLA_ASISTENTE ?? 'asistente';

  constructor(@Inject(DYNAMODB) private readonly db: DynamoDBDocumentClient) {}

  async registrar(registro: RegistroDeAuditoria): Promise<void> {
    const ahora = new Date().toISOString();
    await this.db.send(
      new PutCommand({
        TableName: this.tabla,
        Item: { PK: `AUDITORIA#${registro.orgId}`, SK: `${ahora}#${randomUUID()}`, ...registro, registradaEn: ahora },
      }),
    );
  }

  async ultimas(orgId: string, limite = 50) {
    const r = await this.db.send(
      new QueryCommand({
        TableName: this.tabla,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `AUDITORIA#${orgId}` },
        ScanIndexForward: false,
        Limit: limite,
      }),
    );
    return r.Items ?? [];
  }
}
