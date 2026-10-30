# Abasto

Red mayorista B2B de Bolivia. Segundo parcial de Ingeniería de Software II (ICONIX), Grupo #13, entrega el **3/11/2026**.
Equipo: Andrés Quispe y Jhoel Rodas. Plan vigente: https://claude.ai/artifact/UM6WvqxzsHBXi3Xt4erUgC
Tareas: Trello https://trello.com/b/ABo8gFFG/abasto · Código: GitHub, los dos directo en `main`.

## Decisiones tomadas (no se reabren sin hablarlo entre los dos)

- **Replanteo del 29/10:** el negocio es la **app de clientes** (`apps/app`, Expo, Android e iPhone), con la que tiendas y personas compran al por mayor: buscar (también con una foto), pedir, pagar (QR, contra entrega o crédito) y seguir el pedido. **No hay web de compra.**
- Quien vende gestiona en la web: **Panel Mayorista** (Shell React que carga Gestión en Angular e Inteligencia en Vue como Web Components) y **Superadmin** (React).
- **Abasto vende** (modelo de lanzamiento, 28/10): mientras no hay mayoristas afiliados, Abasto es el vendedor de la casa (`ventas@abasto.bo`), con productos bajo pedido que compra en el mercado cuando entra el pedido.
- **Red privada de precios** (para los mayoristas afiliados; Abasto le muestra precios a todos): una tienda solo ve precios de un mayorista que la aprobó, con su lista (NUEVOS 100 %, FRECUENTES 97 %, VIP 95 %). Nunca se comparan mayoristas ni se ordena por el más barato.
- **Cinco servicios:** pedidos (Spring Boot, hexagonal), catalogo (Laravel, clean), cobros (NestJS, DDD), conecta y asistente (NestJS). El ML vive en `ml/` como procesos programados de Python, no como servicio.
- Ningún servicio lee la base de otro: pide por GraphQL o escucha eventos de RabbitMQ. Toda escritura que llega de afuera trae `Idempotency-Key`.
- Las apps leen y escriben por el **Apollo Router** (GraphQL federado, puerto 4000). REST solo en Conecta (API pública) y Asistente (reportes, MCP).
- Sesión única con **Keycloak** (OIDC + PKCE, `packages/sesion`): entrar en una app abre las otras sin volver a pedir la contraseña.
- Interfaz en español de Bolivia con **tuteo, nunca voseo**. Montos «Bs 1.728,00», fechas dd/mm/aaaa, cantidades siempre con unidad («2 cajas · 96 u.»).
- Las pantallas salen de las maquetas de `docs/uix-mockup/` (ver su README) y usan los tokens de `packages/ui` (verde bosque `hsl(158 64% 28%)`).

## Dueños

**Reparto del 29/10: Andrés lleva todo lo comercial y Jhoel toda la IA.**

| Andrés · lo comercial | Jhoel · la IA |
|---|---|
| **App de clientes** (`apps/app`): pantallas, UIX, lógica, sesión y modo sin señal | **IA local en el teléfono**: `apps/app/src/ia/` (modelo TFLite propio para reconocer productos por foto, ML Kit, lectura de precios) |
| Lógica de compra compartida (`packages/comercio`) | **IA local en el navegador**: voz con Whisper en Inteligencia |
| Panel web: Shell, Gestión (Angular) y el modo PWA | Panel de **Inteligencia** (Vue): reportes generativos y agentes |
| Superadmin (alta y aprobación de mayoristas, tracción) | **Asistente**: agentes, reportes generativos, MCP y proyector de reportes |
| Catálogo (productos, mayoristas, registro, verificación y red privada) | **ML** en `ml/`: demanda, mora, segmentos y el entrenamiento del modelo de visión (TensorFlow → TFLite) |
| Pedidos, Cobros, Conecta, n8n, infra, Router, Keycloak y CI | |

Dentro de la app, las pantallas solo usan la IA a través de `apps/app/src/ia/index.ts`. Jhoel cambia lo que hay detrás sin tocar pantallas. Si necesita cambiar lo que exporta, lo anota en su archivo de estado.

El detalle está en `.github/CODEOWNERS`. Si tu cambio toca una carpeta del otro, avísale en tu archivo de estado de `docs/equipo/` en el mismo commit y dile qué cambiaste.
Antes de cambiar algo en `contracts/`, escríbelo en tu archivo de estado y haz push.

## Estado del equipo

@docs/equipo/andres.md
@docs/equipo/jhoel.md

## Comandos (desde la raíz)

- `pnpm verificar` revisa la máquina · `pnpm install` instala todo lo de TypeScript
- `pnpm infra` levanta Postgres, Mongo, DynamoDB, RabbitMQ, Keycloak, Router y Jaeger
- `pnpm todo` levanta la infra y los cinco servicios en Docker · `pnpm parar` · `pnpm borrar-datos`
- `pnpm dev:panel` · `dev:superadmin` · `pnpm app` (Expo en el puerto 8090) · `app:android` · `dev:cobros` · `dev:conecta` · `dev:asistente` · `dev:pedidos` · `dev:catalogo`
- `pnpm test` (TypeScript) · `test:pedidos` · `test:catalogo` · `test:ml` · `test:todo` · `pnpm e2e` (necesita `pnpm todo`)
- `pnpm arquitectura` revisa las capas · `pnpm supergrafo` recompone el supergrafo · `pnpm n8n` levanta n8n e importa los flujos

Puertos, usuarios de prueba y arranque paso a paso: `README.md`. Arquitectura: `docs/arquitectura.md`.

## Reglas de código

- Cada servicio y app tiene su `CLAUDE.md` con su arquitectura. Respétala: ArchUnit, Deptrac y dependency-cruiser hacen fallar la CI si una capa importa lo que no debe.
- Todo caso de uso lleva prueba automática. Un bug se arregla escribiendo primero la prueba que lo reproduce.
- Una migración que ya está en main no se edita: se escribe otra.
- Si cambias un schema GraphQL, corre `pnpm supergrafo` y sube `infra/router/supergraph.graphql` (la CI lo revisa).
- Nada de secretos en el repo: `.env` está ignorado y cada uno pone su propia `ANTHROPIC_API_KEY`.
- Git: **los dos trabajamos directo en `main`** (decisión del 29/10: sin ramas ni PR). Conventional Commits. Ver «Git en main» abajo.

## Git en main (los dos, sin ramas ni PR)

1. Al empezar y antes de cada push: `git pull --rebase origin main`. Si tienes cambios sin commit, primero haz commit (o `git stash`, pull y `git stash pop`).
2. Commits chicos y push seguido: al terminar cada pedazo que ande, no al final del día. Así el otro recibe tus cambios pronto y los choques son chicos.
3. Antes del push corre las pruebas de lo que tocaste (`pnpm --filter <paquete> test`, `test:pedidos`, `test:catalogo`, etc.). No subas algo que deje main en rojo.
4. **Nunca se pierde trabajo del otro:**
   - Si el rebase choca, junta los dos cambios a mano. Nunca resuelvas con `--ours` o `--theirs` a ciegas ni borres lo que escribió el otro.
   - Prohibido `git push --force`, `git reset --hard` sobre algo ya subido y `git checkout -- .` sin mirar qué se pierde.
   - Si no entiendes qué hizo el otro en un conflicto, para y pregúntale.
5. Choques típicos:
   - `pnpm-lock.yaml`: toma el de main (`git checkout --theirs pnpm-lock.yaml` durante el rebase) y corre `pnpm install` para que sume tus dependencias.
   - `infra/router/supergraph.graphql`: corre `pnpm supergrafo` después de juntar los schemas.
   - Migraciones (Flyway, Asistente, Prisma): si los dos crearon el mismo número, renombra la tuya al siguiente.
6. Si el push lo rechaza porque el otro subió algo, otra vez `git pull --rebase origin main`, las pruebas y push.
7. Lo que vas a cambiar en `contracts/` o en una carpeta del otro, anótalo en tu `docs/equipo/<nombre>.md` en el mismo commit.

## Cosas que ya costaron tiempo

- Windows + Git Bash convierte rutas como `/flujos` en `C:/Program Files/Git/flujos`. Usa los scripts de pnpm o `MSYS_NO_PATHCONV=1`.
- Los puertos no son los estándar (Postgres 5440, Mongo 27020, Keycloak 8180) para no chocar con otros proyectos.
- Catálogo corre en Docker (PHP 8.4 + extensión mongodb): no hace falta PHP en la máquina. Composer: `docker compose exec catalogo composer ...`.
- Angular se queda en 21 mientras alguien tenga Node < 22.22.
- La app (`apps/app`) está fuera del workspace de pnpm: ahí se usa npm. Toma `packages/comercio` y la bandeja de `packages/outbox-offline` por ruta (metro.config.js y tsconfig.json). Corre en el puerto **8090** porque 8081 es Pedidos.
- La saga corre de punta a punta (Pedidos → Catálogo → Cobros). Los pedidos de demostración vencen a las 2 h: `e2e/preparar.ts` los recarga antes de cada corrida.

## Al terminar

Usa `/cerrar` antes de cerrar la sesión.
