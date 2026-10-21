# Conecta · NestJS · dueño: Andrés

La puerta de entrada de afuera: API pública para e-commerce, n8n, el plugin WooCommerce y la sincronización offline de Campo. DynamoDB (8800), puerto 8084.

- Toda escritura trae `Idempotency-Key` (UUID). La idempotencia es una escritura condicional en DynamoDB: el mismo envío repetido devuelve «repetida» con la respuesta original.
- `POST /v1/sincronizacion/lotes` (Campo) y `POST /v1/pedidos` (n8n, e-commerce). Contrato: `contracts/openapi/conecta.yaml`.
- No escribe en bases ajenas: reenvía a los servicios por el Router (GraphQL) con el token del que llama.
- Capas: `dominio/`, `aplicacion/`, `infraestructura/` (dynamodb, destinos, seguridad) e `interfaz/http`.

Probar: `pnpm --filter @abasto/conecta test`; las de integración con `test:e2e` (necesitan `pnpm infra`).
