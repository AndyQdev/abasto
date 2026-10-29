# Jhoel · estado

Actualizado: 28/10/2026 · rama `jhoel/catalogo-gestion` (PR #2, depende del PR #1)

## Estoy en
T18/T19: pregunta por voz o texto → tabla, gráfico y Excel; suite de seguridad del MCP.

## Terminé
- PR #1: Catálogo en la saga (reserva/libera stock, `stock.*` con precio por línea).
- PR #2:
  - Proyector del Asistente: tabla `pedidos` (migración 002), nombres de tienda vía `_entities` de Catálogo, vencimiento del crédito, `producto.stock_cambiado` al reservar, liberar y ajustar.
  - Catálogo: semilla de 40 productos; estado de verificación de organizaciones (`estadoVerificacion`); `crearProducto`, `editarProducto`, `ajustarStock` (editar ya no pisa el stock reservado).
  - Gestión: vista Clientes (aprobar con lista NUEVOS/FRECUENTES/VIP o rechazar).
  - Deptrac de Catálogo funciona dentro de Docker (capa Laravel por espacio de nombres).

## Cambié en contratos
- Schema GraphQL de Catálogo: `Mayorista.estadoVerificacion`, mutaciones `crearProducto`/`editarProducto`/`ajustarStock` e inputs. Subgrafo y supergrafo regenerados.

## Necesito del otro
- Cobros: consumir `cobros.comandos`. Hoy los pedidos quedan en `COBRANDO`.
- Contrato: agregar `vence` a `pedido.confirmado` o `cobro.credito_autorizado` (el proyector usa 15 días mientras tanto).
- Superadmin: puede mostrar `estadoVerificacion` (PENDIENTE/VERIFICADO/RECHAZADO) de cada mayorista.
- Los pedidos de demo vencen a las 2 h: para el e2e, `pnpm borrar-datos` + `pnpm todo`; si Catálogo da 401, `docker compose exec catalogo php artisan cache:clear`.

## Sigue
- T18/T19 (yo). OpenCode: pantalla de Productos en Gestión y diagramas ICONIX.
