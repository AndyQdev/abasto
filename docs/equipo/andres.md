# Andrés · estado

Actualizado: 21/10/2026 · rama main

## Estoy en
Base del monorepo (F0) terminada y probada. Siguiente: la saga de compra completa (F2) del lado de Pedidos y Cobros.

## Terminé
- Infra en Docker: Postgres, Mongo, DynamoDB Local, RabbitMQ, Keycloak (realm con usuarios de prueba), Apollo Router, Jaeger y n8n.
- Pedidos (saga, outbox, inbox, plazos), Cobros (línea de crédito), Conecta (sincronización offline e idempotencia).
- Mercado y Superadmin base; flujo de n8n «Pedido por WhatsApp → Conecta»; CI por carpeta y e2e con Playwright.

## Cambié en contratos
- Primera versión de `contracts/`: asyncapi.yaml, openapi/conecta.yaml, openapi/asistente.yaml y microfrontends.md.

## Necesito del otro
- Catálogo: consumir `catalogo.reservar_stock` de la cola `catalogo.comandos` y publicar `stock.reservado` con `precioUnitarioCentavos` por línea. Sin eso los pedidos quedan en Bs 0.

## Sigue
- Cobros: consumir `cobros.comandos` (autorizar y liberar crédito, QR) y publicar `cobro.*`.
- Pedidos y Cuentas por cobrar dentro de Gestión, según la maqueta del Panel.
