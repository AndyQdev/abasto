# Superadmin · React · dueño: Andrés

El backoffice de Abasto (puerto 5174). Maqueta: `docs/uix-mockup/Abasto v1 – Abasto Backoffice · Superadmin · prototipo navegable.html`.

- Hechos: Tracción (ventas por semana, tiendas activas y recompra; consulta `traccion` de Pedidos, solo admin), **Mayoristas (CU-01, 31/10)**: los que se registran en el Panel esperan en «Por verificar»; se verifica o se rechaza con un motivo que el mayorista ve en su Panel (`mayoristasPorVerificar`, `verificarMayorista`, `rechazarMayorista` de Catálogo; lógica en `src/mayoristas.ts`), Sistema (salud de los servicios) y Auditoría.
- **Desde el 06/11 ningún módulo está en construcción.** Tiendas (`tiendas`, `suspenderTienda`, `reactivarTienda` de Catálogo: una suspendida no entra, su cuenta de Keycloak se apaga y `ReservarStock` rechaza sus pedidos nuevos con el motivo). Reportes (pedidos y tiendas por semana, ventas por ciudad y CSV para Excel; sale de `traccion`). Integraciones (CU-10, `GET /v1/admin/integraciones` de Conecta: llaves, direcciones y avisos que no llegaron, con reenvío). Usuarios (`equipoDeAbasto`, solo lectura: el acceso se da con el rol `admin` en Keycloak; los roles finos de la maqueta no existen). **Reclamos (CU-16):** lo que las tiendas reportan desde la app; Abasto habla con ellas, lo resuelve a mano y aquí anota la respuesta y lo devuelto (`reclamos`, `resolverReclamo` de Pedidos). Solo lo anota: no toca el cobro, el crédito ni la cuenta.
- **Promociones (10/11, notificaciones push, `docs/notificaciones.md`):**
  - Título, mensaje y producto opcional, con la vista previa de cómo se ve en el teléfono y confirmación antes de mandar (llega a todos los que tienen la app).
  - Muestra cuántas salieron y las últimas notificaciones enviadas, también las de los pedidos.
  - Habla con Conecta (`/v1/admin/promociones` y `/v1/admin/notificaciones`). Los productos salen de `misProductos`, que Catálogo ahora también responde al admin.
- Solo entra el rol `admin` (usuario `admin@abasto.bo`).

Probar: `pnpm --filter @abasto/superadmin test`; de punta a punta, `e2e/pruebas/superadmin.spec.ts`.
