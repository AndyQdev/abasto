import { Inject, Injectable } from '@nestjs/common';
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { LlaveDeApi } from '../../dominio/llave-de-api.js';
import type { RegistroDeLlaves, RegistroDeWebhooks } from '../../dominio/puertos.js';
import type { Entrega, Webhook } from '../../dominio/webhook.js';
import { DYNAMODB } from './cliente.js';

const tabla = () => process.env.TABLA_CONECTA ?? 'conecta';
/** Las entregas se guardan 30 días: son para mirar qué pasó y reintentar. */
const DIAS_DE_VIDA = 30;

const PK_LLAVES = 'LLAVES';
const PK_WEBHOOKS = 'WEBHOOKS';
const PK_ENTREGAS = 'ENTREGAS';

const sinClaves = <T>({ PK: _pk, SK: _sk, venceEn: _v, ...resto }: Record<string, unknown>) => resto as T;

/** Trae todas las filas de una partición, página por página. */
async function todasLasFilas(db: DynamoDBDocumentClient, pk: string, filtro: { expresion: string; valores: Record<string, unknown>; nombres?: Record<string, string> } | null = null) {
  const filas: Record<string, unknown>[] = [];
  let desde: Record<string, unknown> | undefined;
  do {
    const r = await db.send(
      new QueryCommand({
        TableName: tabla(),
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': pk, ...filtro?.valores },
        ...(filtro ? { FilterExpression: filtro.expresion } : {}),
        ...(filtro?.nombres ? { ExpressionAttributeNames: filtro.nombres } : {}),
        ExclusiveStartKey: desde,
      }),
    );
    filas.push(...(r.Items ?? []));
    desde = r.LastEvaluatedKey;
  } while (desde);
  return filas;
}

/**
 * Tabla `conecta`, una partición para las llaves (PK LLAVES, SK id). Son pocas filas: buscar por organización
 * filtrando sale barato y evita un índice aparte. Si crecen mucho, se suma un índice por org_id sin tocar el resto.
 */
@Injectable()
export class LlavesDynamoDB implements RegistroDeLlaves {
  constructor(@Inject(DYNAMODB) private readonly db: DynamoDBDocumentClient) {}

  async guardar(llave: LlaveDeApi) {
    await this.db.send(new PutCommand({ TableName: tabla(), Item: { PK: PK_LLAVES, SK: llave.id, ...llave } }));
  }

  async porId(id: string) {
    const { Item } = await this.db.send(new GetCommand({ TableName: tabla(), Key: { PK: PK_LLAVES, SK: id } }));
    return Item ? sinClaves<LlaveDeApi>(Item) : null;
  }

  async deOrganizacion(orgId: string) {
    const filas = await todasLasFilas(this.db, PK_LLAVES, { expresion: 'orgId = :org', valores: { ':org': orgId } });
    return filas.map((f) => sinClaves<LlaveDeApi>(f));
  }

  async todas() {
    return (await todasLasFilas(this.db, PK_LLAVES)).map((f) => sinClaves<LlaveDeApi>(f));
  }

  async borrar(id: string) {
    await this.db.send(new DeleteCommand({ TableName: tabla(), Key: { PK: PK_LLAVES, SK: id } }));
  }

  async anotarUso(id: string, cuando: string) {
    await this.db.send(
      new UpdateCommand({
        TableName: tabla(),
        Key: { PK: PK_LLAVES, SK: id },
        UpdateExpression: 'SET ultimoUsoEn = :cuando',
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeValues: { ':cuando': cuando },
      }),
    );
  }
}

/**
 * Webhooks (PK WEBHOOKS, SK id) y entregas (PK ENTREGAS, SK id). El id de la entrega ordena por fecha y no cambia si
 * el evento se repite: la escritura condicional hace que no se creen dos.
 */
@Injectable()
export class WebhooksDynamoDB implements RegistroDeWebhooks {
  constructor(@Inject(DYNAMODB) private readonly db: DynamoDBDocumentClient) {}

  async guardar(webhook: Webhook) {
    await this.db.send(new PutCommand({ TableName: tabla(), Item: { PK: PK_WEBHOOKS, SK: webhook.id, ...webhook } }));
  }

  async porId(id: string) {
    const { Item } = await this.db.send(new GetCommand({ TableName: tabla(), Key: { PK: PK_WEBHOOKS, SK: id } }));
    return Item ? sinClaves<Webhook>(Item) : null;
  }

  async deOrganizacion(orgId: string) {
    const filas = await todasLasFilas(this.db, PK_WEBHOOKS, { expresion: 'orgId = :org', valores: { ':org': orgId } });
    return filas.map((f) => sinClaves<Webhook>(f));
  }

  async todos() {
    return (await todasLasFilas(this.db, PK_WEBHOOKS)).map((f) => sinClaves<Webhook>(f));
  }

  async borrar(id: string) {
    await this.db.send(new DeleteCommand({ TableName: tabla(), Key: { PK: PK_WEBHOOKS, SK: id } }));
  }

  private fila(entrega: Entrega) {
    return { PK: PK_ENTREGAS, SK: entrega.id, ...entrega, venceEn: Math.floor(Date.now() / 1000) + DIAS_DE_VIDA * 86_400 };
  }

  async crearEntrega(entrega: Entrega) {
    try {
      await this.db.send(new PutCommand({ TableName: tabla(), Item: this.fila(entrega), ConditionExpression: 'attribute_not_exists(PK)' }));
      return true;
    } catch (e) {
      if ((e as Error).name === 'ConditionalCheckFailedException') return false;
      throw e;
    }
  }

  async guardarEntrega(entrega: Entrega) {
    await this.db.send(new PutCommand({ TableName: tabla(), Item: this.fila(entrega) }));
  }

  async entregaPorId(id: string) {
    const { Item } = await this.db.send(new GetCommand({ TableName: tabla(), Key: { PK: PK_ENTREGAS, SK: id } }));
    return Item ? sinClaves<Entrega>(Item) : null;
  }

  async entregasPorReintentar(hasta: string) {
    const filas = await todasLasFilas(this.db, PK_ENTREGAS, {
      expresion: '#estado = :pendiente AND proximoEn <= :hasta',
      nombres: { '#estado': 'estado' },
      valores: { ':pendiente': 'pendiente', ':hasta': hasta },
    });
    return filas.map((f) => sinClaves<Entrega>(f));
  }

  async entregasDe(orgId: string, limite: number) {
    const filas = await todasLasFilas(this.db, PK_ENTREGAS, { expresion: 'orgId = :org', valores: { ':org': orgId } });
    return filas.map((f) => sinClaves<Entrega>(f)).sort((a, b) => b.id.localeCompare(a.id)).slice(0, limite);
  }

  async ultimasEntregas(limite: number) {
    const { Items = [] } = await this.db.send(
      new QueryCommand({
        TableName: tabla(),
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': PK_ENTREGAS },
        ScanIndexForward: false,
        Limit: limite,
      }),
    );
    return Items.map((f) => sinClaves<Entrega>(f));
  }
}
