// Crea las tablas de DynamoDB si no existen. Es idempotente: se puede correr las veces que haga falta.
// `pnpm tablas` (también lo corren `pnpm infra` y `pnpm todo`). Con DYNAMODB_URL=aws crea en AWS.
import { CreateTableCommand, DescribeTimeToLiveCommand, DynamoDBClient, ListTablesCommand, UpdateTimeToLiveCommand } from '@aws-sdk/client-dynamodb';

const url = process.env.DYNAMODB_URL ?? 'http://localhost:8800';
const db = new DynamoDBClient(
  url === 'aws'
    ? {}
    : { endpoint: url, region: 'us-east-1', credentials: { accessKeyId: 'local', secretAccessKey: 'local' } },
);

const tablas = [
  // Conecta: claves de idempotencia de cada operación que llega de afuera
  { TableName: 'idempotencia', llaves: [['clave', 'HASH']] },
  // Conecta: integraciones, llaves de API (hash), webhooks y sus entregas. Diseño de una sola tabla
  { TableName: 'conecta', llaves: [['PK', 'HASH'], ['SK', 'RANGE']] },
  // Asistente: conversaciones, propuestas de los agentes y auditoría del MCP
  { TableName: 'asistente', llaves: [['PK', 'HASH'], ['SK', 'RANGE']] },
];

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let existentes;
for (let intento = 1; ; intento++) {
  try {
    existentes = new Set((await db.send(new ListTablesCommand({}))).TableNames);
    break;
  } catch (e) {
    if (intento >= 20) throw new Error(`DynamoDB no responde en ${url}: ${e.message}`);
    await esperar(1000);
  }
}

for (const { TableName, llaves } of tablas) {
  if (existentes.has(TableName)) {
    console.log(`DynamoDB: ${TableName} ya existe`);
    continue;
  }
  await db.send(
    new CreateTableCommand({
      TableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: llaves.map(([AttributeName]) => ({ AttributeName, AttributeType: 'S' })),
      KeySchema: llaves.map(([AttributeName, KeyType]) => ({ AttributeName, KeyType })),
    }),
  );
  console.log(`DynamoDB: ${TableName} creada`);
}

// Lo que vence se borra solo en AWS (la bitácora, las entregas y las claves de idempotencia llevan `venceEn`).
// DynamoDB Local acepta la configuración pero no borra: por eso cada lectura también revisa el vencimiento donde importa.
for (const TableName of ['idempotencia', 'conecta']) {
  const { TimeToLiveDescription: ttl } = await db.send(new DescribeTimeToLiveCommand({ TableName }));
  if (ttl?.TimeToLiveStatus === 'ENABLED' || ttl?.TimeToLiveStatus === 'ENABLING') continue;
  await db.send(new UpdateTimeToLiveCommand({ TableName, TimeToLiveSpecification: { AttributeName: 'venceEn', Enabled: true } }));
  console.log(`DynamoDB: ${TableName} borra lo vencido`);
}
