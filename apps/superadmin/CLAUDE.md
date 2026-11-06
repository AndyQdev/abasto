# Superadmin · React · dueño: Andrés

El backoffice de Abasto (puerto 5174). Maqueta: `docs/uix-mockup/Abasto v1 – Abasto Backoffice · Superadmin · prototipo navegable.html`.

- Hechos: Tracción (ventas por semana, tiendas activas y recompra; consulta `traccion` de Pedidos, solo admin), **Mayoristas (CU-01, 31/10)**: los que se registran en el Panel esperan en «Por verificar»; se verifica o se rechaza con un motivo que el mayorista ve en su Panel (`mayoristasPorVerificar`, `verificarMayorista`, `rechazarMayorista` de Catálogo; lógica en `src/mayoristas.ts`), Sistema (salud de los servicios) y Auditoría.
- **Desde el 06/11 ningún módulo está en construcción.** Tiendas (`tiendas`, `suspenderTienda`, `reactivarTienda` de Catálogo: una suspendida no entra, su cuenta de Keycloak se apaga y `ReservarStock` rechaza sus pedidos nuevos con el motivo). Reportes (pedidos y tiendas por semana, ventas por ciudad y CSV para Excel; sale de `traccion`). Integraciones (CU-10, `GET /v1/admin/integraciones` de Conecta: llaves, direcciones y avisos que no llegaron, con reenvío). Usuarios (`equipoDeAbasto`, solo lectura: el acceso se da con el rol `admin` en Keycloak; los roles finos de la maqueta no existen). **Reclamos no está en el menú:** falta decidir cómo se devuelve el dinero.
- Solo entra el rol `admin` (usuario `admin@abasto.bo`).

Probar: `pnpm --filter @abasto/superadmin test`; de punta a punta, `e2e/pruebas/superadmin.spec.ts`.
