import { Inject, Injectable } from '@nestjs/common';
import { GetCommand, PutCommand, QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Propuesta } from '../../agentes/dominio/agente.js';
import type { RepositorioDePropuestas } from '../../agentes/puertos.js';
import { DYNAMODB } from './cliente.js';

/** Tabla `asistente`: PK = PROPUESTAS#<org>, SK = <id>. */
@Injectable()
export class PropuestasDynamoDB implements RepositorioDePropuestas {
  private readonly tabla = process.env.TABLA_ASISTENTE ?? 'asistente';

  constructor(@Inject(DYNAMODB) private readonly db: DynamoDBDocumentClient) {}

  async guardar(propuesta: Propuesta): Promise<void> {
    await this.db.send(
      new PutCommand({ TableName: this.tabla, Item: { PK: `PROPUESTAS#${propuesta.orgId}`, SK: propuesta.id, ...propuesta } }),
    );
  }

  async buscar(orgId: string, id: string): Promise<Propuesta | null> {
    const r = await this.db.send(new GetCommand({ TableName: this.tabla, Key: { PK: `PROPUESTAS#${orgId}`, SK: id } }));
    return r.Item ? sinLlaves(r.Item) : null;
  }

  async pendientes(orgId: string): Promise<Propuesta[]> {
    const r = await this.db.send(
      new QueryCommand({
        TableName: this.tabla,
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: 'estado = :pendiente',
        ExpressionAttributeValues: { ':pk': `PROPUESTAS#${orgId}`, ':pendiente': 'pendiente' },
      }),
    );
    return (r.Items ?? []).map(sinLlaves);
  }
}

function sinLlaves(item: Record<string, unknown>): Propuesta {
  const { PK: _pk, SK: _sk, ...propuesta } = item;
  return propuesta as unknown as Propuesta;
}
