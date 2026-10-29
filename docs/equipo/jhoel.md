# Jhoel · estado

Actualizado: 28/10/2026 · rama `jhoel/reservar-stock`

## Estoy en
Catálogo en la saga (tarjeta 8): reservar y liberar stock. Código listo y probado; falta commit, PR y confirmar el e2e con datos de demo frescos.

## Terminé
- Catálogo consume `catalogo.reservar_stock` y `catalogo.liberar_stock` (cola `catalogo.comandos`) y publica `stock.reservado` (con `precioUnitarioCentavos` por línea, ya con la lista de la tienda), `stock.rechazado` y `stock.liberado`.
- Reserva atómica por línea en Mongo (`stock >= cantidad` con `$inc`) y compensación si falla una línea; idempotente por pedido (colección `reservas`); mensajes con id determinista.
- 31 pruebas Pest nuevas/unitarias, PHPStan y Deptrac en verde; probado contra RabbitMQ real.

## Cambié en contratos
- Nada. Se respeta `contracts/asyncapi.yaml` tal cual.

## Necesito del otro
- `docker-compose.yml` (servicio `catalogo`): arranca también `php artisan catalogo:escuchar` y recibe `RABBITMQ_HOST/PUERTO`. Dockerfile de Catálogo ahora instala `sockets` (lo pide php-amqplib).
- Acordar `relacion.aprobada` y `catalogo.reingresar_stock` (devoluciones); todavía no están en el contrato.
- Los datos de demo de Pedidos vencen con el tiempo: tras días parado, `pnpm borrar-datos` + `pnpm todo` para que el e2e vuelva a ver «Despensa Lupita» por confirmar.

## Sigue
- Semilla de 40 productos y verificación de organizaciones (OpenCode, ramas `jhoel/semilla-catalogo` y `jhoel/verificacion-catalogo`).
- Gestión: Clientes y Productos.
