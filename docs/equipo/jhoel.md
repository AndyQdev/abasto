# Jhoel · estado

Actualizado: 28/10/2026 · rama `jhoel/proyector-asistente` (sale de `jhoel/reservar-stock`, PR #1)

## Estoy en
Proyector CQRS del Asistente (tarjeta 17) terminado y probado con un pedido real. Espera a que se mergee el PR #1 para abrir su PR.

## Terminé
- Catálogo en la saga (PR #1): reserva/libera stock y responde `stock.reservado` (precio por línea con la lista de la tienda), `stock.rechazado`, `stock.liberado`.
- Catálogo publica `producto.stock_cambiado` al reservar y al liberar (stock vivo en reportes).
- Proyector: tabla nueva `pedidos` (migración 002) con estado y motivo; nombre de tienda resuelto con `_entities` de Catálogo; cuentas por cobrar con vencimiento. Pedido real A-1100 → proyectado con «Tienda Doña Rosa» y stock 312 → 264.

## Cambié en contratos
- Nada. `producto.stock_cambiado` ya estaba en `contracts/asyncapi.yaml`; ahora lo publica Catálogo con `{productoId, nombre, stock}`.

## Necesito del otro
- Cobros: consumir `cobros.comandos`. Hoy los pedidos quedan en `COBRANDO` tras reservar el stock.
- Contrato: agregar `vence` (fecha de pago del crédito) a `pedido.confirmado` o a `cobro.credito_autorizado`. Mientras no esté, el proyector usa 15 días.
- `docker-compose.yml`: `catalogo` arranca `catalogo:escuchar` + `RABBITMQ_*`; `asistente` recibe `CATALOGO_URL`.
- Tras `pnpm borrar-datos`, si Catálogo da 401: `docker compose exec catalogo php artisan cache:clear` (JWKS en caché 10 min).

## Sigue
- Integrar ramas de OpenCode: semilla 40 productos, verificación de organizaciones, vista Clientes, API de Productos.
- T18/T19: pregunta por voz o texto → tabla, gráfico y Excel; suite de seguridad del MCP.
