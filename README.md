# Abasto

Red mayorista B2B de Bolivia: los mayoristas publican su catálogo con precios por cuarta, docena, caja o fardo, y las tiendas compran desde Abasto o desde su propio e-commerce. **Red privada de precios:** una tienda solo ve los precios de un mayorista que la aprobó como cliente.

Segundo parcial de Ingeniería de Software II (ICONIX) · Grupo #13 · Quispe Cabrera José Andrés y Rodas Cabrera Jhoel.

## Qué hay

| Carpeta | Qué es | Tecnología | Puerto |
|---|---|---|---|
| `services/pedidos` | Pedidos y saga de compra | Spring Boot 4, hexagonal, Postgres | 8081 |
| `services/catalogo` | Catálogo, stock, red privada | Laravel 13, clean, MongoDB | 8082 |
| `services/cobros` | QR, crédito, cuotas | NestJS, DDD, Postgres + Prisma | 8083 |
| `services/conecta` | API pública, sync offline, idempotencia | NestJS, DynamoDB | 8084 |
| `services/asistente` | Reportes en lenguaje natural, agentes, MCP | NestJS, Postgres, DynamoDB | 8085 |
| `ml/` | Demanda, mora, segmentos, visión | Python, scikit-learn, TensorFlow | — |
| `apps/panel-shell` | Panel Mayorista: el marco | React | 5170 |
| `apps/panel-gestion` | Panel: productos, pedidos, clientes, cuentas | Angular (Web Component) | 5171 |
| `apps/panel-inteligencia` | Panel: reportes y agentes | Vue (Web Component) | 5172 |
| `apps/superadmin` | Backoffice de Abasto | React | 5174 |
| `apps/app` | **La app de clientes**: compran al por mayor tiendas y personas | Expo (Android e iPhone) | 8090 (vista web) |
| `infra/` | Postgres, Mongo, DynamoDB, RabbitMQ, Keycloak, Router, n8n | Docker Compose | |
| `contracts/` | AsyncAPI, OpenAPI y el contrato de microfrontends | | |
| `packages/` | `ui` (tokens), `sesion` (Keycloak), `outbox-offline`, `comercio` (lógica de compra de la app) | | |
| `e2e/` | Pruebas punta a punta | Playwright | |

## Arranque

Necesitas Node 22+, pnpm 12, Docker Desktop y git. Java 17+ y uv solo si vas a tocar Pedidos o ML fuera de Docker.

```bash
pnpm verificar      # revisa la máquina y los puertos
pnpm install
pnpm todo           # infraestructura + los 5 servicios en Docker (la primera vez tarda: compila todo)
pnpm dev:panel      # Panel en http://localhost:5170
pnpm semilla        # catálogo de demostración y Abasto como vendedor de la casa
pnpm app            # la app de clientes (vista web en http://localhost:8090; Android: pnpm app:android)
pnpm e2e            # las pruebas punta a punta, para ver que todo anda
```

Solo la infraestructura (para correr un servicio en tu máquina): `pnpm infra`. Parar: `pnpm parar`. Empezar de cero: `pnpm borrar-datos`.

## Usuarios de prueba

Todos con la clave `abasto123`.

| Usuario | Rol | Empresa |
|---|---|---|
| `ventas@abasto.bo` | mayorista y admin | **Abasto**, el vendedor de la casa: Panel y Superadmin |
| `lospozos@abasto.bo` | mayorista y tienda | Distribuidora Los Pozos |
| `laramada@abasto.bo` | mayorista | Importadora La Ramada |
| `donarosa@abasto.bo` | tienda | Tienda Doña Rosa (para probar la app de clientes) |
| `admin@abasto.bo` | admin | Abasto (Superadmin) |

## Consolas

| | Dirección | Acceso |
|---|---|---|
| Keycloak | http://localhost:8180 | admin / admin |
| Apollo Router (GraphQL) | http://localhost:4000 | token de un usuario de prueba |
| RabbitMQ | http://localhost:15680 | abasto / abasto |
| Jaeger (trazas) | http://localhost:16686 | |
| n8n (`pnpm n8n`) | http://localhost:5678 | se crea la cuenta la primera vez |

Postgres en `localhost:5440`, MongoDB en `27020` y DynamoDB Local en `8800`. Los puertos se cambian en `.env` (ver `.env.example`).

## Pruebas

```bash
pnpm test           # TypeScript: apps, paquetes y servicios NestJS
pnpm test:pedidos   # Spring (Testcontainers)
pnpm test:catalogo  # Pest dentro del contenedor
pnpm test:ml        # pytest
pnpm arquitectura   # dependency-cruiser: las capas no se cruzan
pnpm e2e            # Playwright contra el sistema levantado con pnpm todo
```

La CI (`.github/workflows/ci.yml`) corre cada stack solo si cambió su carpeta, y la punta a punta en cada push a main (los dos trabajamos directo en main).

## Despliegue en la nube

Google Cloud (Keycloak, Router, webs y Catálogo con Mongo), AWS (Conecta con DynamoDB y n8n) y Azure (Pedidos, Cobros, Asistente, Postgres y RabbitMQ). Panel: https://panel.34-136-24-10.sslip.io. Qué va dónde, cómo se creó, cómo se actualiza un solo módulo, los problemas y cómo se borra: **`docs/despliegue.md`**. Archivos en `infra/despliegue/`.

## Para seguir

- `CLAUDE.md`: decisiones, dueños y reglas. Cada servicio y app tiene el suyo.
- `docs/arquitectura.md`: cómo encajan las piezas.
- `docs/despliegue.md`: el despliegue en AWS, Azure y Google Cloud.
- `docs/uix-mockup/README.md`: qué maqueta es de qué interfaz.
- `docs/iconix/`: los diagramas del método.
- `docs/equipo/`: en qué está cada uno.
