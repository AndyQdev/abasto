# Plan de Jhoel · lectura y pendientes

Actualizado: 25/10/2026 · rama `jhoel/campo-tflite`

Sirve para retomar en orden. Marca `[x]` al terminar. Al empezar una sesión, corre `/empezar` y sigue desde el primer `[ ]`.

## 1. Traer lo último
- [x] `git switch main && git pull --rebase`.
- [x] Crear la rama `jhoel/campo-tflite`.

## 2. Leer el estado del equipo
- [x] `docs/equipo/andres.md`: dejó la base F0 (infra, Pedidos, Cobros, Conecta, Mercado, Superadmin, e2e). Pidió a Catálogo consumir `catalogo.reservar_stock` y publicar `stock.reservado`.
- [x] `docs/equipo/jhoel.md`.
- [x] Revisar primero si hay cambios en `contracts/`: Andrés dejó la primera versión (asyncapi, openapi, microfrontends).

## 3. Leer las reglas en orden
- [x] `CLAUDE.md` de la raíz (decisiones, dueños, comandos, reglas de código).
- [x] `docs/equipo/*.md`.
- [ ] `docs/arquitectura.md`.
- [ ] `docs/iconix/README.md`.
- [ ] `docs/uix-mockup/README.md` y las maquetas de mis pantallas.
- [ ] `CLAUDE.md` de mis carpetas: `apps/campo`, `apps/panel-gestion`, `apps/panel-shell`, `apps/panel-inteligencia`, `services/catalogo`, `services/asistente`, `ml`.
- [ ] `contracts/asyncapi.yaml` completo (primer pase hecho; hallazgos en el punto 7).
- [ ] `.github/CODEOWNERS` y la plantilla de PR.

## 4. Infraestructura y pruebas
- [x] `pnpm verificar` e `pnpm install`.
- [x] `pnpm todo` (12 contenedores) y `pnpm test` (58).
- [x] `pnpm test:catalogo` (22), `pnpm test:ml` (6) y `pnpm e2e` (3/3, sembrando Catálogo antes).
- [ ] Si cambio un schema GraphQL: `pnpm supergrafo` y `docker compose restart router`.

## 5. Trello
- [ ] Abrir https://trello.com/b/ABo8gFFG/abasto y ubicar mis tarjetas.
- [ ] Anotar aquí cada una: título, lista y criterio de aceptación.
- [ ] Elegir la siguiente con Andrés y moverla a «En curso».

Bloqueo: desde esta máquina el tablero responde 401 (pide sesión). Necesito que me pegues las tarjetas o me des acceso.

## 6. Trabajo pendiente (en orden acordado)
- [ ] Catálogo: consumir `catalogo.reservar_stock` y publicar `stock.reservado` con `precioUnitarioCentavos` por línea. Sin esto los pedidos quedan en Bs 0.
- [ ] Catálogo: liberar stock cuando la saga cancele.
- [ ] Gestión: clientes F1 (solicitudes, aprobar con lista de precios y límite de crédito).
- [x] Campo: smoke test TFLite + ML Kit en el HONOR 90 (57 ms; OCR «Shampoo 400 ml / Bs 18,50»).
- [ ] Campo: subir el modelo real (`ml/.../productos.tflite`) y conectar la pantalla de conteo.
- [ ] Asistente e Inteligencia: según la tarjeta de Trello.

## 7. Hallazgos de `contracts/asyncapi.yaml` (para hablar con Andrés)
- `catalogo.liberar_stock` no trae `pedidoId` ni líneas.
- La «una sola actualización condicional» no cubre pedidos con varias líneas.
- `stock.reservado.lineas` no trae `productoId`; depende del orden del pedido.
- La idempotencia por `Sobre.id` se rompe si Pedidos reintenta con otro sobre; propongo `pedidoId` + `lineaId`.
- `orgId` se usa sin definirlo en el sobre ni en el esquema.
- Falta la conversión `presentacion` → `unidades` (cajas/sueltas) y quién la hace.

## 8. Deudas y notas de máquina
- e2e: `pnpm todo` y `e2e/preparar.ts` no siembran Catálogo; correr `docker compose exec catalogo php artisan catalogo:semilla`. Va en un PR aparte.
- Windows: CMake 3.22.1 trae Ninja 1.10.2, que no soporta rutas de más de 260 caracteres; lo cambié por 1.12.1. Solo mi máquina.
- `gh` no está instalado: el PR se abre desde el enlace que da GitHub al hacer push.

## 9. Al cerrar
- [ ] Correr `/cerrar`: pruebas, `jhoel.md` de máximo 20 líneas, commit, PR y tarjeta de Trello.
