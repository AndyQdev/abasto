# Pedidos · Spring Boot 4 · arquitectura hexagonal · dueño: Andrés

Pedidos y la saga de compra (pedido → reservar stock en Catálogo → cobrar en Cobros → confirmar). Base `pedidos` en Postgres (5440), puerto 8081.

- `dominio/` no importa Spring ni JPA: Pedido, LineaDePedido, SagaDeCompra (máquina de estados), Dinero.
- `aplicacion/puertos` define lo que necesita; `aplicacion/servicios` implementa los casos de uso.
- `adaptadores/entrada` (GraphQL federado) y `adaptadores/salida` (JPA, RabbitMQ) implementan los puertos. `configuracion/` los conecta.
- ArchUnit falla si una capa importa lo que no debe.
- Eventos: se escriben en `outbox` en la misma transacción y un publicador los manda a `abasto.eventos`. Lo que llega se registra en `inbox` para no procesarlo dos veces.
- Migraciones Flyway en `src/main/resources/db/migration`. `R__datos_demo` solo corre con el perfil `demo`.
- Schema GraphQL: `src/main/resources/graphql/schema.graphqls`. Si cambia: `pnpm supergrafo` en la raíz.

- **Reclamos (CU-16, 06/11):** `dominio/Reclamo`, `ReclamosServicio`, tabla `reclamos` (uno por pedido). La tienda lo abre (`abrirReclamo`, sale del token) y solo el rol `admin` lista y resuelve (`reclamos`, `resolverReclamo`). **Decisión de Andrés:** Abasto resuelve a mano y el sistema solo anota lo devuelto: sin saga ni compensación, no toca Cobros. Publica `pedido.reclamo_abierto` y `pedido.reclamo_resuelto` por el outbox (Conecta avisa a la app y al e-commerce; Asistente los ignora). `Pedido.reclamo` va con `@BatchMapping`: una lista de pedidos hace una sola consulta.

Probar: `pnpm test:pedidos` (las de integración usan Testcontainers: Docker tiene que estar corriendo). Correr fuera de Docker: `pnpm dev:pedidos`.
