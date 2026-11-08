# Asistente · NestJS · dueño: Jhoel

Reportes en lenguaje natural, agentes, servidor MCP y el proyector CQRS. Base `reportes` en Postgres y DynamoDB, puerto 8085.

- `reportes/`: la pregunta se convierte en SQL y la **guardia** (`guardia-sql.ts`, allowlist con node-sql-parser) decide si se puede correr. Se corre como `mcp_lector`: solo lectura, RLS por `org_id`, 5 s y 1000 filas como máximo.
- El modelo de lenguaje es Gemini en Vertex AI (`ModeloVertex`, SDK `@google/genai`). Se activa con `GOOGLE_CLOUD_PROJECT` (+ `GOOGLE_CLOUD_LOCATION` y la cuenta de servicio en `GOOGLE_APPLICATION_CREDENTIALS`) o con `VERTEX_API_KEY`; el modelo con `ASISTENTE_MODELO` (por defecto `gemini-3.8-flash`). Sin eso usa `ModeloSimulado` (respuestas fijas para la demo y las pruebas).
- `agentes/`: los agentes **proponen**, nunca ejecutan solos. La persona aprueba y la acción sale por n8n.
- `proyector/`: escucha todos los eventos de RabbitMQ y llena la base `reportes`.
- `mcp/`: MCP Streamable HTTP en `/mcp`, con auditoría en DynamoDB.
- Migraciones propias en `migraciones/`. `pnpm --filter @abasto/asistente semilla` las aplica y carga datos de demo con fechas relativas a hoy.

Probar: `pnpm --filter @abasto/asistente test`; la suite de seguridad con `test:e2e` (contra Postgres real).
Evaluar el Analista: `pnpm --filter @abasto/asistente evaluar` corre 20 preguntas de negocio y las compara con su respuesta correcta (meta: 18/20 con Gemini; sin Vertex configurado usa el simulado y solo prueba el evaluador).
