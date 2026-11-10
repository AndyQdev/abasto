import { Inject, Injectable } from '@nestjs/common';
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Dispositivo, Promocion } from '../../dominio/notificacion.js';
import type { RegistroDeAvisos, RegistroDeDispositivos, RegistroDePromociones } from '../../dominio/puertos.js';
import { DYNAMODB } from './cliente.js';

const tabla = () => process.env.TABLA_CONECTA ?? 'conecta';
const PK_DISPOSITIVOS = 'DISPOSITIVOS';
const PK_PROMOCIONES = 'PROMOCIONES';
/** Lo justo para cubrir las reentregas de RabbitMQ; después el TTL lo borra (en AWS). */
const DIAS_DEL_AVISO = 3;

const sinClaves = <T>({ PK: _pk, SK: _sk, venceEn: _v, ...resto }: Record<string, unknown>) => resto as T;

async function particion(db: DynamoDBDocumentClient, pk: string) {
  const filas: Record<string, unknown>[] = [];
  let desde: Record<string, unknown> | undefined;
  do {
    const r = await db.send(
      new QueryCommand({ TableName: tabla(), KeyConditionExpression: 'PK = :pk', ExpressionAttributeValues: { ':pk': pk }, ExclusiveStartKey: desde }),
    );
    filas.push(...(r.Items ?? []));
    desde = r.LastEvaluatedKey;
  } while (desde);
  return filas;
}

/**
 * Teléfonos con la app: tabla `conecta`, partición DISPOSITIVOS, una fila por token (un teléfono que cambia de cuenta
 * se sobrescribe). Buscar los de una tienda filtra la partición: con cientos de teléfonos sale barato; con miles se
 * suma un índice por orgId sin tocar el resto.
 */
@Injectable()
export class DispositivosDynamoDB implements RegistroDeDispositivos {
  constructor(@Inject(DYNAMODB) private readonly db: DynamoDBDocumentClient) {}

  async guardar(d: Dispositivo) {
    await this.db.send(new PutCommand({ TableName: tabla(), Item: { PK: PK_DISPOSITIVOS, SK: d.token, ...d } }));
  }

  async porToken(token: string) {
    const { Item } = await this.db.send(new GetCommand({ TableName: tabla(), Key: { PK: PK_DISPOSITIVOS, SK: token } }));
    return Item ? sinClaves<Dispositivo>(Item) : null;
  }

  async quitar(token: string) {
    await this.db.send(new DeleteCommand({ TableName: tabla(), Key: { PK: PK_DISPOSITIVOS, SK: token } }));
  }

  async deOrganizacion(orgId: string) {
    return (await this.todos()).filter((d) => d.orgId === orgId);
  }

  async todos() {
    return (await particion(this.db, PK_DISPOSITIVOS)).map((f) => sinClaves<Dispositivo>(f));
  }
}

/** Promociones enviadas: partición PROMOCIONES, SK el id (el Idempotency-Key del Superadmin). */
@Injectable()
export class PromocionesDynamoDB implements RegistroDePromociones {
  constructor(@Inject(DYNAMODB) private readonly db: DynamoDBDocumentClient) {}

  async crearSiNoExiste(p: Promocion) {
    try {
      await this.db.send(
        new PutCommand({ TableName: tabla(), Item: { PK: PK_PROMOCIONES, SK: p.id, ...p }, ConditionExpression: 'attribute_not_exists(PK)' }),
      );
      return true;
    } catch (e) {
      if ((e as Error).name === 'ConditionalCheckFailedException') return false;
      throw e;
    }
  }

  async porId(id: string) {
    const { Item } = await this.db.send(new GetCommand({ TableName: tabla(), Key: { PK: PK_PROMOCIONES, SK: id } }));
    return Item ? sinClaves<Promocion>(Item) : null;
  }

  async actualizar(p: Promocion) {
    await this.db.send(new PutCommand({ TableName: tabla(), Item: { PK: PK_PROMOCIONES, SK: p.id, ...p } }));
  }

  async ultimas(cuantas: number) {
    const todas = (await particion(this.db, PK_PROMOCIONES)).map((f) => sinClaves<Promocion>(f));
    return todas.sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)).slice(0, cuantas);
  }
}

/** Un evento avisa una sola vez: escritura condicional por su id (`AVISO#<id>`), que se borra sola a los 3 días. */
@Injectable()
export class AvisosDynamoDB implements RegistroDeAvisos {
  constructor(@Inject(DYNAMODB) private readonly db: DynamoDBDocumentClient) {}

  async primeraVez(eventoId: string) {
    try {
      await this.db.send(
        new PutCommand({
          TableName: tabla(),
          Item: { PK: `AVISO#${eventoId}`, SK: '-', venceEn: Math.floor(Date.now() / 1000) + DIAS_DEL_AVISO * 86_400 },
          ConditionExpression: 'attribute_not_exists(PK)',
        }),
      );
      return true;
    } catch (e) {
      if ((e as Error).name === 'ConditionalCheckFailedException') return false;
      throw e;
    }
  }
}
