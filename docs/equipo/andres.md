# Andrés · estado

> **Jhoel, empieza aquí (29/10). Reemplaza a los avisos anteriores.**
>
> 1. **Git:** los dos trabajamos directo en `main`, sin ramas ni PR. Para bajar todo: `git switch main && git pull --rebase origin main`, después `pnpm install`. Si te queda algo sin subir en otra rama, haz commit allí, `git switch main`, `git merge <tu-rama>` y push. Reglas en «Git en main» del `CLAUDE.md`.
> 2. **Reparto: Andrés lleva lo comercial y tú toda la IA.** Tuyo:
>    - La IA local del teléfono: `apps/app/src/ia/` y `apps/app/assets/modelos/`.
>    - La IA local del navegador (Whisper) y el Panel de Inteligencia (Vue).
>    - El Asistente: agentes, reportes generativos, MCP y proyector.
>    - El ML de `ml/`.
>
>    Catálogo, Panel Shell, Gestión y el resto de la app pasan a mí. Lo que hiciste ahí queda; desde ahora lo sigo yo.
> 3. **No cambiamos los requisitos del ingeniero**, solo dónde ocurre cada caso de uso. Están todos en `docs/requisitos.md`, con dónde se cumplen y qué falta. Los casos de uso están en `docs/iconix/README.md`.
> 4. **Las interfaces:**
>    - **App de clientes** (`apps/app`, Expo, Android e iPhone): las tiendas buscan, piden a cualquier mayorista, pagan y siguen el pedido.
>    - **Panel** (web PWA): el mayorista gestiona.
>    - **Superadmin**: Abasto aprueba mayoristas.
>
>    Mercado (web) y Campo ya no existen. Abasto vende como un mayorista más (el «vendedor de la casa»).
> 5. **Frontera dentro de la app:** mis pantallas solo importan de `apps/app/src/ia/index.ts`. Lo de adentro lo cambias sin tocar pantallas. Lo primero que necesito: `reconocerProducto(fotoUri)` → `[{ codigo, confianza }]`.
> 6. **Si el Panel o la app no te dejan entrar** (cliente `abasto-app` de Keycloak): `pnpm borrar-datos`, `pnpm todo` y `pnpm semilla`. La app usa el puerto 8090.
>
> Tus tareas están en Trello, en la tarjeta «LEER PRIMERO · Reparto nuevo» y en las que tienen tu nombre. El prompt para tu Claude está en `docs/PROMPT-JHOEL.md`.

Actualizado: 29/10/2026 · en main (los dos trabajamos ahí)

## Estoy en
La app de clientes en el emulador Android. Después: registro de mayoristas y aprobación en el Superadmin (CU-01), y registro de tiendas desde la app (CU-15).

## Terminé
- Infra, Pedidos (saga, outbox, inbox, plazos), Conecta, n8n, CI y e2e.
- Cobros en la saga: autorizar y liberar crédito, QR que vence a los 30 min, pagarQrDePrueba y Pedido.cobro por federación.
- App de clientes (`apps/app`, Expo): Inicio, Buscar, buscar por foto, Vendedor, carrito, finalizar (QR, crédito o contra entrega), Mis pedidos, seguimiento y modo sin señal.
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
- Jhoel: `reconocerProducto(fotoUri)` en `apps/app/src/ia` con el modelo TFLite entrenado con las fotos del catálogo.

## Sigue
- CU-01: registro de mayoristas y aprobación en el Superadmin.
- CU-15: registro de tiendas desde la app.
- Registrar el cobro de los pedidos contra entrega y las cuentas por cobrar (CU-09).
- Investigar de dónde y cómo cargar el catálogo real.
