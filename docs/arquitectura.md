# Arquitectura

```mermaid
flowchart LR
  subgraph Interfaces
    A[App de clientes<br/>Expo · Android e iPhone]
    subgraph Panel[Panel Mayorista]
      S[Shell React] --> G[Gestión<br/>Angular]
      S --> I[Inteligencia<br/>Vue]
    end
    SA[Superadmin<br/>React]
  end

  KC[(Keycloak<br/>sesión única)]
  R{{Apollo Router<br/>GraphQL federado}}

  A & G & SA --> R
  I -->|REST| AS
  A -->|pedidos sin señal| CO
  N8N[n8n<br/>WhatsApp, acciones] -->|REST| CO

  R --> P[Pedidos<br/>Spring · hexagonal]
  R --> CA[Catálogo<br/>Laravel · clean]
  R --> CB[Cobros<br/>NestJS · DDD]
  CO[Conecta<br/>NestJS] --> R
  AS[Asistente<br/>NestJS]

  P --- PG1[(Postgres<br/>pedidos)]
  CB --- PG2[(Postgres<br/>cobros)]
  CA --- MG[(MongoDB)]
  CO --- DY[(DynamoDB)]
  AS --- PG3[(Postgres<br/>reportes)]
  AS --- DY
  ML[ml/ Python<br/>procesos nocturnos] --- PG3

  P & CA & CB -.eventos.-> MQ[[RabbitMQ]]
  MQ -.-> AS
```

## Reglas que sostienen todo

1. **Cada dato tiene un solo dueño.** Ningún servicio lee la base de otro. Si necesita un dato ajeno, lo pide por GraphQL (a través del Router) o lo recibe por evento.
2. **Las apps hablan con un solo punto: el Router.** Una pantalla pide en una sola consulta datos de Pedidos, Catálogo y Cobros; el Router los junta con Federation 2.
3. **Toda escritura que llega de afuera es idempotente.** Conecta guarda la `Idempotency-Key` con una escritura condicional en DynamoDB: un reintento devuelve la respuesta original y no duplica.
4. **Los eventos salen por outbox.** El servicio guarda el cambio y el evento en la misma transacción; un publicador lo manda después a RabbitMQ. Quien lo consume lo anota en su inbox para no procesarlo dos veces.
5. **Sesión única.** Keycloak emite el token. Cada servicio lo valida contra las llaves públicas del realm (JWKS) y toma la empresa de `org_id`.

## La saga de compra

```mermaid
sequenceDiagram
  participant T as Tienda (Mercado)
  participant P as Pedidos
  participant CA as Catálogo
  participant CB as Cobros
  T->>P: crearPedido (GraphQL)
  P->>CA: catalogo.reservar_stock
  CA-->>P: stock.reservado (con precios) / stock.rechazado
  P->>CB: cobros.autorizar_credito o cobros.generar_qr
  CB-->>P: cobro.credito_autorizado / cobro.qr_pagado / cobro.rechazado
  P-->>T: pedido.por_confirmar → el mayorista confirma
  Note over P: Si un paso falla o vence el plazo,<br/>Pedidos compensa: libera el stock y el crédito
```

`SagaDeCompra` (Pedidos) es la máquina de estados que decide el siguiente paso y las compensaciones. `RevisorDePlazos` cancela lo que se quedó esperando.

**Estado actual:** Pedidos publica los comandos y mueve la saga con las respuestas. Faltan los consumidores: Catálogo (reservar y liberar stock) y Cobros (autorizar y liberar crédito, QR). Hasta entonces, un pedido nuevo queda pendiente y en Bs 0.

## Red privada de precios

`PoliticaDePrecios` (Catálogo) decide qué escalas ve cada empresa:

- El mayorista ve sus precios base.
- Una tienda aprobada ve las escalas con el porcentaje de su lista: NUEVOS 100 %, FRECUENTES 97 %, VIP 95 %.
- Una tienda sin relación, o con la solicitud pendiente o rechazada, no ve precios.
- Una empresa que es mayorista y tienda a la vez no ve sus propios productos en Mercado.

## Reportes y agentes

El proyector del Asistente escucha todos los eventos y llena la base `reportes` (CQRS). El ML escribe ahí sus predicciones. Una pregunta en lenguaje natural se convierte en SQL; la guardia la revisa (solo SELECT sobre tablas permitidas) y se corre como `mcp_lector`, con seguridad por fila según la empresa, 5 segundos y 1000 filas como máximo. Los agentes proponen acciones (por ejemplo, recordatorios de cobranza); una persona las aprueba y n8n las ejecuta.

## Observabilidad

Los servicios mandan trazas OpenTelemetry a Jaeger (http://localhost:16686): una consulta del Panel se ve pasando por el Router y cada subgrafo.
