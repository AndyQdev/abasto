# Superadmin · React · dueño: Andrés

El backoffice de Abasto (puerto 5174). Maqueta: `docs/uix-mockup/Abasto v1 – Abasto Backoffice · Superadmin · prototipo navegable.html`.

- Hechos: Tracción (ventas por semana, tiendas activas y recompra; consulta `traccion` de Pedidos, solo admin), **Mayoristas (CU-01, 31/10)**: los que se registran en el Panel esperan en «Por verificar»; se verifica o se rechaza con un motivo que el mayorista ve en su Panel (`mayoristasPorVerificar`, `verificarMayorista`, `rechazarMayorista` de Catálogo; lógica en `src/mayoristas.ts`), Sistema (salud de los servicios) y Auditoría. El resto de los módulos (`modulos.ts`) muestra en qué fase se construye.
- Solo entra el rol `admin` (usuario `admin@abasto.bo`).

Probar: `pnpm --filter @abasto/superadmin test`.
