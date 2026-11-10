# Conecta · NestJS · dueño: Andrés

La puerta de entrada de afuera: API pública para e-commerce, n8n, el plugin WooCommerce, el MCP de compras y la sincronización de la app sin señal. DynamoDB (8800), puerto 8084.

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

- **Conectar un e-commerce (CU-10, 06/11):** contrato en `contracts/openapi/conecta.yaml`; e2e `e2e/pruebas/tienda-en-linea.spec.ts`.
  - **Llaves de API** (`aplicacion/llaves-de-api.ts`): `abk_<id>_<secreto>`. Cada una es un cliente de Keycloak (`llave-<id>`) con `org_id` fijo, audiencia `abasto-api` y rol `tienda` (`infraestructura/keycloak/cuentas.keycloak.ts`, los crea la cuenta `conecta-integraciones` de `infra/keycloak/al-dia.mjs`). Pedidos, Catálogo y Cobros no cambian: ven a la misma tienda. Conecta guarda solo la huella. El guard busca la llave en cada llamada (revocarla corta al momento) y deja en `peticion.token` el token de verdad. Una llave no puede manejar otras llaves.
  - **Webhooks** (`aplicacion/webhooks.ts`): cola durable `conecta.webhooks` (`pedido.*`, `cobro.*`). Cada aviso se anota antes de intentarlo (id determinístico: repetir el evento no crea otro) y un revisor reintenta cada 30 s lo que toca (1, 5, 30, 120 y 720 min; después queda `fallida` y se reenvía a mano). Firma `sha256=` HMAC de `fecha.cuerpo`. Solo https y direcciones públicas, revisado también al enviar y sin seguir redirecciones (`entregador.http.ts`). `WEBHOOKS_PERMITIR_LOCAL=si` solo en desarrollo: `docker-compose.yml` lo trae prendido, **en producción hay que apagarlo**.
  - **MCP de compras** (`interfaz/mcp/servidor-mcp.ts`, `POST /mcp`): `abasto-compras` con ver_mayoristas, buscar_productos, crear_pedido, ver_pedido y mis_pedidos. Pasa por los mismos caminos que la API; en la bitácora sale con origen `mcp`.
  - **Idempotencia por empresa:** el registro guarda `<empresa>|<clave>` (06/11): la clave de una tienda nunca choca ni le responde a otra. Pedidos rechaza con `CLAVE_EN_USO` una clave que ya usó otra tienda.
  - Tablas: particiones `LLAVES`, `WEBHOOKS` y `ENTREGAS` en `conecta` (`integraciones.dynamodb.ts`). `crear-tablas.mjs` activa el TTL de `venceEn` (solo borra en AWS; DynamoDB Local no).

- **Notificaciones push (10/11, `docs/notificaciones.md`):**
  - **Teléfonos:** la app registra su token de Firebase (`PUT /v1/dispositivos`, partición `DISPOSITIVOS`) y lo da de baja al salir.
  - **Avisos de pedidos:** la cola durable `conecta.notificaciones` (`pedido.*`, `cobro.*`) avisa a los teléfonos de la tienda en cada paso del pedido.
    - Lo que se dice está en `dominio/notificacion.ts`.
    - Etiqueta `pedido-<id>` (también en `data.tag`): un paso reemplaza al otro en la bandeja.
    - «En camino» va fija: sale como mensaje de solo datos y la arma la app (`mensajeFijo` en `enviador.firebase.ts`).
    - `AVISO#<id del evento>`: un evento suena una sola vez.
  - **Promociones:** `POST /v1/admin/promociones` (solo admin, con `Idempotency-Key`) las manda a todos los teléfonos.
  - **Envío:** Firebase API v1 sin SDK (`infraestructura/push/enviador.firebase.ts`): JWT RS256 con la cuenta de servicio de `FIREBASE_CREDENCIALES`. Sin ese archivo, modo prueba: se anota y no sale.
  - **Para el Superadmin:** `GET /v1/admin/notificaciones` da el resumen y las últimas 50.

Probar: `pnpm --filter @abasto/conecta test`; las de integración con `test:e2e` (necesitan `pnpm infra`).
