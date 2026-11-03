import { Inject, Injectable } from '@nestjs/common';
import { PutCommand, QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { EntradaDeBitacora } from '../../dominio/bitacora.js';
import type { Bitacora } from '../../dominio/puertos.js';
import { DYNAMODB } from './cliente.js';

/** Lo que entra se guarda 30 días: es para mirar qué pasó, no un registro contable. */
const DIAS_DE_VIDA = 30;

/**
 * Tabla `conecta` (diseño de una sola tabla): PK = BITACORA#<mayorista>, SK = <ocurridoEn>#<clave>.
 * Así la consulta de un mayorista sale ordenada por fecha sin índices extra.
 */
@Injectable()
export class BitacoraDynamoDB implements Bitacora {
  private readonly tabla = process.env.TABLA_CONECTA ?? 'conecta';

  constructor(@Inject(DYNAMODB) private readonly db: DynamoDBDocumentClient) {}

  async anotar(entrada: EntradaDeBitacora): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tabla,
        Item: {
          PK: `BITACORA#${entrada.mayoristaId}`,
          SK: `${entrada.ocurridoEn}#${entrada.clave}`,
          ...entrada,
          venceEn: Math.floor(Date.now() / 1000) + DIAS_DE_VIDA * 86_400,
        },
      }),
    );
  }

  async delMayorista(mayoristaId: string, limite: number): Promise<EntradaDeBitacora[]> {
    const { Items = [] } = await this.db.send(
      new QueryCommand({
        TableName: this.tabla,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `BITACORA#${mayoristaId}` },
        ScanIndexForward: false,
        Limit: limite,
      }),
    );
    return Items.map(({ PK: _pk, SK: _sk, venceEn: _v, ...entrada }) => entrada as EntradaDeBitacora);
  }
}
