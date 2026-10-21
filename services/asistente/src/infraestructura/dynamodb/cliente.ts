import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const DYNAMODB = Symbol('DynamoDB');

/**
 * En desarrollo apunta a DynamoDB Local (puerto 8800). En AWS se quita DYNAMODB_URL
 * y el SDK toma la región y las credenciales del entorno: el código no cambia.
 */
export function crearClienteDynamoDB(): DynamoDBDocumentClient {
  const url = process.env.DYNAMODB_URL ?? 'http://localhost:8800';
  const cliente = new DynamoDBClient(
    url === 'aws'
      ? {}
      : {
          endpoint: url,
          region: 'us-east-1',
          credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
        },
  );
  return DynamoDBDocumentClient.from(cliente, { marshallOptions: { removeUndefinedValues: true } });
}
