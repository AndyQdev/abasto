# Andrés · estado

Actualizado: 21/10/2026 · rama andres/mercado-catalogo

## Estoy en
F1 · Mercado (CU-03 y CU-05): buscar mayoristas, ver el catálogo con el precio de mi lista y pedir ser cliente. Terminado y en PR.

## Terminé
- Infra en Docker: Postgres, Mongo, DynamoDB Local, RabbitMQ, Keycloak (realm con usuarios de prueba), Apollo Router, Jaeger y n8n.
- Pedidos (saga, outbox, inbox, plazos), Cobros (línea de crédito), Conecta (sincronización offline e idempotencia).
- Mercado y Superadmin base; flujo de n8n «Pedido por WhatsApp → Conecta»; CI por carpeta y e2e con Playwright.
- Mercado según la maqueta: Inicio, Buscar (productos y mayoristas, por rubro, sobre el catálogo guardado), ficha de producto con precios por volumen y perfil del mayorista con «Pedir ser cliente». e2e de la cita 2 en verde.

## Cambié en contratos
- Primera versión de `contracts/`: asyncapi.yaml, openapi/conecta.yaml, openapi/asistente.yaml y microfrontends.md.
- Nada nuevo en esta rama. Ojo: `e2e/preparar.ts` borra la relación `dr|lr` de la colección `relaciones` de Catálogo antes de las pruebas. Si cambias el nombre de esa colección, avísame.

## Necesito del otro
- Catálogo: consumir `catalogo.reservar_stock` de la cola `catalogo.comandos` y publicar `stock.reservado` con `precioUnitarioCentavos` por línea. Sin eso los pedidos quedan en Bs 0.
- Catálogo (cuando puedas): un campo con la lista de la tienda en `Mayorista` (por ejemplo `miLista: ListaDePrecios`) para mostrar «Tu lista: FRECUENTES» en Mercado, y una foto por producto.

## Sigue
- Cobros: cuentas por cobrar, cuotas y pagos (CU-09), y consumir `cobros.comandos` (autorizar y liberar crédito, QR) para la saga.
- Pedidos y Cuentas por cobrar dentro de Gestión, según la maqueta del Panel.
