# Conecta · NestJS · dueño: Andrés

La puerta de entrada de afuera: API pública para e-commerce, n8n, el plugin WooCommerce y la sincronización offline de Campo. DynamoDB (8800), puerto 8084.

- Toda escritura trae `Idempotency-Key` (UUID). La idempotencia es una escritura condicional en DynamoDB: el mismo envío repetido devuelve «repetida» con la respuesta original.
- `POST /v1/sincronizacion/lotes` (Campo) y `POST /v1/pedidos` (n8n, e-commerce). Contrato: `contracts/openapi/conecta.yaml`.
- No escribe en bases ajenas: reenvía a los servicios por el Router (GraphQL) con el token del que llama.
- Capas: `dominio/`, `aplicacion/`, `infraestructura/` (dynamodb, destinos, seguridad, mensajeria) e `interfaz/` (http, ws).
- **Tiempo real (02/11): WebSocket `/v1/tiempo-real`** en el mismo puerto. Reemplaza al sondeo de la app (Mis pedidos y Seguimiento ya no preguntan cada pocos segundos).
  - Entrada: `infraestructura/mensajeria/eventos.rabbitmq.ts` escucha `pedido.*` y `cobro.*` de `abasto.eventos` con una cola **exclusiva por instancia** que se borra sola (los avisos son en vivo: si nadie estaba conectado no se guardan; al reconectar, la app pide la lista). Sin RabbitMQ, reintenta cada 5 s y la API sigue.
  - Reparto: `aplicacion/canal-de-tiendas.ts` manda cada evento solo a las conexiones de su tienda (`datos.tiendaId`; Pedidos y Cobros la ponen siempre). El aviso es `{tipo, pedidoId, codigo, ocurridoEn}`: sin montos ni líneas.
  - Protocolo (`interfaz/ws/conexion.ts`): la app manda `{"tipo":"hola","token":…}` (nunca en la URL), Conecta responde `{"tipo":"listo"}`. Cierres: 4401 sin sesión, 4001 token vencido (cierra al `exp` del token), 4400 mensaje raro. Ping cada 25 s (`tiempo-real.servidor.ts`).
  - Cobros publica `cobro.qr_generado` (aditivo) para que la app sepa cuándo ya puede mostrar el QR.
  - Contrato: `contracts/openapi/conecta.yaml` (`/v1/tiempo-real`) y `contracts/asyncapi.yaml` (`cobro.qr_generado`). e2e: `e2e/pruebas/tiempo-real.spec.ts`.

- **Bitácora (03/11, Panel › Conecta):** cada `pedido.crear` que entra (por `POST /v1/pedidos` o por un lote de la app sin señal) queda anotado para su mayorista con el origen (`X-Abasto-Origen`: whatsapp, tienda-en-linea o api; los lotes son app-sin-senal), qué pasó (aplicada, repetida, conflicto, rechazada), el motivo y el código, total y tienda que devolvió Pedidos. Tabla `conecta` (PK `BITACORA#<mayorista>`, SK `<fecha>#<clave>`, 30 días). Anotar nunca hace fallar el pedido. `GET /v1/bitacora` da los últimos 100 del mayorista del token con el resumen. El flujo de n8n manda `X-Abasto-Origen: whatsapp`. CORS acepta el Panel (5170). e2e: `e2e/pruebas/conecta.spec.ts`.

Probar: `pnpm --filter @abasto/conecta test`; las de integración con `test:e2e` (necesitan `pnpm infra`).
