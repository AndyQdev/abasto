# Andrés · estado

> **Jhoel: nuevo reparto (29/10). Andrés lleva todo lo comercial y tú toda la IA.**
>
> - **Tuyo:**
>   - La IA local del teléfono: `apps/app/src/ia/` y `apps/app/assets/modelos/`. Ahí va el modelo TFLite propio que reconoce productos por foto; es el punto de deep learning con TensorFlow sobre imágenes.
>   - La IA local del navegador (Whisper) y el Panel de Inteligencia (Vue).
>   - El Asistente (agentes, reportes generativos, MCP y proyector).
>   - El ML de `ml/` (demanda, mora, segmentos y entrenar el modelo de visión).
> - **Pasa a Andrés:** Catálogo, Panel Shell, Gestión y el modo PWA del Panel, la app entera fuera de `src/ia/` y todo lo de vender y comprar. Tu trabajo en esas carpetas queda como está; desde ahora lo sigo yo.
> - **Dentro de la app, la frontera es `apps/app/src/ia/index.ts`:**
>   - Mis pantallas solo importan de ahí.
>   - Lo que esté detrás lo cambias sin tocar pantallas.
>   - Si cambias lo que exporta, anótalo en `jhoel.md`.
>   - Lo próximo que necesito de ti es `reconocerProducto(fotoUri)`, que devuelva los códigos de producto más parecidos con su confianza, para combinarlo con la lectura de la etiqueta.
> - El detalle está en «Dueños» del `CLAUDE.md` y en `.github/CODEOWNERS`.

> **Jhoel: desde el 29/10 trabajamos los dos directo en `main`. Se acabaron las ramas y los PR.**
>
> - Ya junté todo en main: tus ramas `proyector-entrega`, `foto-producto` y `panel-pwa`, más todo lo mío. No se perdió nada y las pruebas pasan. Las ramas viejas (`andres/*`, `jhoel/*`) ya no se usan: todo lo que tenían está en main.
> - Tu Claude tiene que hacer esto: `git switch main && git pull --rebase origin main`. Si te queda trabajo sin subir en otra rama, haz commit allí, después `git switch main`, `git merge <tu-rama>` y push.
> - Al empezar y antes de cada push: `git pull --rebase origin main`. Commits chicos y push seguido. Si choca, se juntan los dos cambios a mano y nunca se usa `--force`. Las reglas completas están en «Git en main» del `CLAUDE.md`, y `/empezar` y `/cerrar` ya las siguen.
>
> **Lee también lo que cambió el 29/10 en las apps:**
>
> 1. **Ya no hay web de compra.** Se borró `apps/mercado`. Los que compran (tiendas y personas) usan la **app de clientes** `apps/app`, hecha con Expo para Android e iPhone. Es lo que hace ganar plata, estilo Alibaba: buscar, buscar con una foto, carrito, pedir, pagar (QR, contra entrega o crédito) y seguir el pedido.
> 2. **Campo dejó de ser una app aparte.** `apps/campo` se convirtió en `apps/app`. Tu diagnóstico de TFLite y ML Kit sigue ahí (`src/diagnostico.tsx`) y la app usa ML Kit para leer la etiqueta de la foto. La app la llevo yo; **los modelos (TFLite) siguen siendo tuyos.**
> 3. **Quien vende gestiona todo en la web**: el Panel (tu Shell, Gestión e Inteligencia) y el Superadmin. Cargar productos con foto, que hacía Campo, pasa al Panel: es tarea tuya en Trello.
> 4. **Abasto vende por su cuenta** mientras no hay afiliados: es el «vendedor de la casa» (`ventas@abasto.bo`, que es mayorista y admin), con productos bajo pedido que se compran en el mercado. Toqué Catálogo para eso (Organizacion.deLaCasa, Producto.abastecimiento, costo y proveedor, `catalogo:semilla-abasto`). **Revísalo, por favor.**
> 5. La lógica de compra (catálogo, carrito y saga) está en `packages/comercio`. La app la toma por ruta.
> 6. Keycloak: el cliente `abasto-app` reemplaza a `abasto-mercado` y `abasto-campo`. Como el realm vive en Postgres, **tienes que empezar de cero**: `pnpm borrar-datos`, después `pnpm todo` y `pnpm semilla`.
> 7. Puertos: la app usa el **8090** (el 8081 es Pedidos). Ya no se usa el 5173.
> 8. Todo está en `main` (ver arriba).
>
> Tus tareas nuevas en Trello: «Panel · cargar productos con foto», «App · buscar por foto con el modelo de productos (TFLite)», «App · fotos de los productos» y revisar Catálogo. Las tarjetas de Campo y de Mercado web quedaron cerradas.

Actualizado: 29/10/2026 · en main (los dos trabajamos ahí)

## Estoy en
La app de clientes (`apps/app`, Expo). Falta correrla en el emulador y en los teléfonos.

## Terminé
- Infra, Pedidos (saga, outbox, inbox, plazos), Conecta, n8n, CI y e2e.
- Cobros en la saga: autorizar y liberar crédito, QR que vence a los 30 min, pagarQrDePrueba y Pedido.cobro por federación.
- Mercado: Inicio, Buscar, fichas, carrito, finalizar (QR, crédito o contra entrega), Mis pedidos y seguimiento de la saga.
- Abasto vende:
  - Catálogo: Abasto como vendedor de la casa y productos BAJO_PEDIDO con costo y proveedor (`catalogo:semilla-abasto`).
  - Pedidos: CONTRA_ENTREGA, listaDeCompras, avanzarEntrega y traccion (solo admin).
  - Panel: Compras (lista por puesto con margen) y Preparar/Despachar/Entregar en Pedidos.
  - Superadmin: Tracción.
  - Usuario ventas@abasto.bo (org abasto).
- e2e: 14 pruebas en verde.

## Cambié en contratos
- Cobros: cobroDePedido, pagarQrDePrueba, CobroQr y Pedido.cobro.
- Catálogo: Producto.abastecimiento/entregaHoras/costoUnitario/proveedor, Mayorista.deLaCasa e inputs de crear/editar.
- Pedidos: MetodoPago.CONTRA_ENTREGA, listaDeCompras, avanzarEntrega y traccion.
- AsyncAPI: contra_entrega y pedido.en_preparacion | despachado | entregado. OpenAPI de Conecta: CONTRA_ENTREGA.

## Necesito del otro
- Jhoel: revisar los cambios en services/catalogo (vendedor de la casa y bajo pedido) y el módulo Compras en el menú del Shell.
- Jhoel (cuando pueda): que el proyector de Asistente registre pedido.en_preparacion, despachado y entregado.
- Catálogo: un campo con la lista de la tienda en Mayorista y una foto por producto.

## Sigue
- Registro de tiendas nuevas desde la app (sin pedírselo a nadie) para la promoción.
- Registrar el cobro de los pedidos contra entrega y las cuentas por cobrar (CU-09).
- Investigar de dónde y cómo cargar el catálogo real.
