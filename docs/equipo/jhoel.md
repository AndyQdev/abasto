# Jhoel · estado

Actualizado: 25/10/2026 · rama `jhoel/campo-tflite`

## Estoy en
Probé TFLite y ML Kit en mi HONOR 90 (Android 15, arm64) y funcionan. La pantalla de diagnóstico de Campo quedó lista con un modelo de ejemplo; falta el modelo real de productos.

## Terminé
- Entorno en verde: `pnpm verificar`, `pnpm install`, `pnpm todo` (12 contenedores), `pnpm test` (58), `pnpm test:catalogo` (22), `pnpm test:ml` (6) y `pnpm e2e` (3/3 después de sembrar Catálogo).
- Campo: pantalla «Diagnóstico TFLite / ML Kit» (`apps/campo/src/diagnostico.tsx`) con MobileNetV1 de ejemplo y OCR sobre un cartel. Sumé `apps/campo/src/modelo.ts` con sus 4 pruebas (11/11 en Campo, `tsc` limpio).
- Prueba en el teléfono: modelo cargado (`entrada 1×224×224×3 uint8`, `salida 1×1001 uint8`, delegados cpu), inferencia en 57 ms; ML Kit leyó «Shampoo 400 ml / Bs 18,50» y `leerPrecio` devolvió «Bs 18,50».

## Cambié en contratos
- Nada todavía.

## Necesito del otro
- Revisión de `contracts/asyncapi.yaml` (lo leí desde Catálogo; no toqué nada):
  - `catalogo.liberar_stock` no trae `pedidoId` ni líneas: no se sabe qué pedido liberar ni qué cantidades devolver.
  - La «una sola actualización condicional» no cubre pedidos con varias líneas: hacen falta N reservas/liberaciones atómicas o un lote.
  - `stock.reservado.lineas` no trae `productoId`; depende del orden del pedido, frágil si Pedidos reordena o reintenta.
  - La idempotencia se apoya en `Sobre.id`; si Pedidos reintenta con otro sobre, se duplica la reserva. Propongo clave estable `pedidoId` + `lineaId`.
  - `orgId` se usa sin definirse en el sobre ni en el esquema.
  - Falta la conversión `presentacion` → `unidades` (cajas/sueltas) y quién la hace.
- `pnpm todo` y `e2e/preparar.ts` no siembran Catálogo: el e2e necesita `docker compose exec catalogo php artisan catalogo:semilla` antes. Deuda para un PR aparte.
- En Windows tuve que cambiar el Ninja 1.10.2 que trae CMake 3.22.1 por 1.12.1 para compilar Campo (rutas de más de 260 caracteres). Es de mi máquina, no del repo; lo dejo anotado para que no te sorprenda.

## Sigue
- Subir el modelo real (`ml/.../productos.tflite`) y conectar la pantalla de conteo de Campo.
- Catálogo: reservar y liberar stock para la saga.
- Clientes en Gestión: solicitudes, aprobar con lista de precios y límite de crédito (F1).
