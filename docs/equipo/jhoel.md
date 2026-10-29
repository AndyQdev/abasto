# Jhoel · estado

Actualizado: 28/10/2026 · rama `jhoel/reportes-voz` (sale de `jhoel/catalogo-gestion`, PR #2)

## Estoy en
T18 y T19 terminados en `jhoel/reportes-voz`; esperan a que se mergeen los PR #1 y #2.

## Terminé
- T18: preguntar por voz con Whisper dentro del navegador (IA local, el audio no sale del equipo) y gráfico de barras/línea en el reporte. Probado con audio real en español.
- T19: la guardia SQL rechaza también conversiones a tipos del sistema (regclass, oid) y permite CTE (WITH) sin abrir tablas prohibidas; suite de seguridad contra Postgres 7/7 (aislamiento de `pedidos`, inbox ilegible, `set_config` negado); evaluador de 20 preguntas (`pnpm --filter @abasto/asistente evaluar`).
- PR #1: Catálogo en la saga (reserva/libera stock, `stock.*` con precio por línea).
- PR #2:
  - Proyector del Asistente: tabla `pedidos` (migración 002), nombres de tienda vía `_entities` de Catálogo, vencimiento del crédito, `producto.stock_cambiado` al reservar, liberar y ajustar.
  - Catálogo: semilla de 40 productos; estado de verificación de organizaciones (`estadoVerificacion`); `crearProducto`, `editarProducto`, `ajustarStock` (editar ya no pisa el stock reservado).
  - Gestión: vista Clientes (aprobar con lista NUEVOS/FRECUENTES/VIP o rechazar).
  - Deptrac de Catálogo funciona dentro de Docker (capa Laravel por espacio de nombres).

## Cambié en contratos
- Schema GraphQL de Catálogo: `Mayorista.estadoVerificacion`, mutaciones `crearProducto`/`editarProducto`/`ajustarStock` e inputs. Subgrafo y supergrafo regenerados.

## Necesito del otro
- Una `ANTHROPIC_API_KEY` para la demo y para medir el Analista (meta 18/20). Sin llave usa el modelo simulado (acierta 2/20: solo conoce las preguntas de la demo).
- Cobros: consumir `cobros.comandos`. Hoy los pedidos quedan en `COBRANDO`.
- Contrato: agregar `vence` a `pedido.confirmado` o `cobro.credito_autorizado` (el proyector usa 15 días mientras tanto).
- Superadmin: puede mostrar `estadoVerificacion` (PENDIENTE/VERIFICADO/RECHAZADO) de cada mayorista.
- Los pedidos de demo vencen a las 2 h: para el e2e, `pnpm borrar-datos` + `pnpm todo`; si Catálogo da 401, `docker compose exec catalogo php artisan cache:clear`.

## Sigue
- T18/T19 (yo). OpenCode: pantalla de Productos en Gestión y diagramas ICONIX.
