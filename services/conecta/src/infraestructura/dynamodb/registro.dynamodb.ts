import { Inject, Injectable } from '@nestjs/common';
import { DeleteCommand, GetCommand, PutCommand, UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { RegistroDeIdempotencia, Reserva } from '../../dominio/puertos.js';
import { DYNAMODB } from './cliente.js';

const HORAS_DE_VIDA = 48;

/**
 * Tabla `idempotencia` (clave primaria: clave).
 * La reserva es una escritura condicional: DynamoDB garantiza que solo una gana.
 * DynamoDB Local no borra por TTL, así que el vencimiento se revisa en la condición.
 */
@Injectable()
export class RegistroDynamoDB implements RegistroDeIdempotencia {
  private readonly tabla = process.env.TABLA_IDEMPOTENCIA ?? 'idempotencia';

  constructor(@Inject(DYNAMODB) private readonly db: DynamoDBDocumentClient) {}

  async reservar(clave: string, huella: string): Promise<Reserva> {
    const ahora = Math.floor(Date.now() / 1000);
    try {
      await this.db.send(
        new PutCommand({
          TableName: this.tabla,
          Item: { clave, huella, estado: 'en_curso', venceEn: ahora + HORAS_DE_VIDA * 3600 },
          ConditionExpression: 'attribute_not_exists(clave) OR venceEn < :ahora',
          ExpressionAttributeValues: { ':ahora': ahora },
        }),
      );
      return { tipo: 'nueva' };
    } catch (e) {
      if ((e as Error).name !== 'ConditionalCheckFailedException') throw e;
    }

    const { Item } = await this.db.send(
      new GetCommand({ TableName: this.tabla, Key: { clave }, ConsistentRead: true }),
    );
    if (!Item) return { tipo: 'en_curso' };
    if (Item.huella !== huella) return { tipo: 'conflicto' };
    if (Item.estado !== 'completa') return { tipo: 'en_curso' };
    return { tipo: 'repetida', respuesta: JSON.parse(String(Item.respuesta ?? 'null')) };
  }

  async completar(clave: string, respuesta: unknown): Promise<void> {
    await this.db.send(
      new UpdateCommand({
        TableName: this.tabla,
        Key: { clave },
        UpdateExpression: 'SET estado = :completa, respuesta = :respuesta',
        ExpressionAttributeValues: { ':completa': 'completa', ':respuesta': JSON.stringify(respuesta ?? null) },
      }),
    );
  }

  async liberar(clave: string): Promise<void> {
    await this.db.send(new DeleteCommand({ TableName: this.tabla, Key: { clave } }));
  }
}
