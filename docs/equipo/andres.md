# Andrés · estado

> **Jhoel, empieza aquí (01/11): enfoque nuevo de la app.** Pega en tu Claude el prompt «Retomar (01/11)» de `docs/PROMPT-JHOEL.md`. En corto:
> - Clientes en tres tipos: Hogar, Tienda y Productor (salteñería, panadería o pensión). Se elige al registrarse y cambia el Inicio.
> - «Mi negocio» (Mi casa / Mi tienda / Producción): inventario que se llena solo con lo que se compra en Abasto. Siguen la caja, el fiado, las recetas, el planificador y las cuentas, todo respaldado en la base de datos del servidor. El plan está en `docs/plan-mi-negocio.md`.
> - Toqué solo `apps/app/src/ia/index.ts`: ML Kit y TFLite se cargan al usarlos, para que la app abra en Expo Go (iPhone). En Android no cambia nada.
> - La barra de abajo quedó en Inicio, Carrito, Mi negocio, Pedidos y Cuenta. Buscar se abre desde el buscador del Inicio.
>
> **Aviso anterior (29/10), sigue vigente en lo que no cambió arriba:**
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

Actualizado: 03/11/2026 · en main (los dos trabajamos ahí)

## Estoy en
Las fases que faltan del Panel web: Cuentas por cobrar (CU-09) y Conecta, que siguen «en construcción». Después: registro de tiendas desde la app (CU-15).

## Terminé
- **Panel PWA lista para la IA local del navegador (03/11, lo pidió el ingeniero: «el navegador debe tener su IA local» y «ambos deben funcionar offline»):** probé el Panel construido sin señal con el diseño v7 (e2e `panel-sin-senal` en verde) y Whisper sin internet (e2e nuevo `ia-navegador-sin-senal`, con `IA_NAVEGADOR=1`). El service worker guardaba el modelo dos veces (en su caché y en la de transformers.js): ahora deja pasar Hugging Face y guarda una vez la librería del CDN con versión fija (`abasto-ia-local`). Manifiesto e íconos con la identidad v7, «Instalar el Panel» en el menú del perfil y almacenamiento persistente.
  **Jhoel:** `pnpm dev:panel:pwa` levanta el Panel como PWA (Shell construido en 5170 + Gestión e Inteligencia en desarrollo); con `pnpm dev:panel` no hay service worker. Para sumar otra IA en el navegador: librería del CDN con versión exacta en la URL y modelos guardados por la librería; si usa otro host, se agrega en `apps/panel-shell/src/offline/ia-local.ts`. Agregué una sección en `contracts/microfrontends.md` («IA local del navegador en la PWA»), sin cambiar nada de lo que ya existía.
- **Panel web, versión 7 «Halo» (02/11):** header verde bosque con la curva que abraza al menú blanco flotante, dock derecho (Alertas, Agentes, Reportes, Tableros y Ayuda), buscador que lleva al pedido o al producto, y Pedidos (tablero de tres columnas con detalle al costado), Compras (checklist por puesto e imprimir), Productos (tarjetas, activar o pausar, crear y editar con foto) y Clientes («Te compran») rehechos. Aviso a Jhoel: Inteligencia toma los colores nuevos sola (son variables del Shell); su título sigue en mayúsculas con su estilo. En `contracts/microfrontends.md` solo agregué el evento `abasto:buscar`.
- Infra, Pedidos (saga, outbox, inbox, plazos), Conecta, n8n, CI y e2e.
- Cobros en la saga: autorizar y liberar crédito, QR que vence a los 30 min, pagarQrDePrueba y Pedido.cobro por federación.
- App de clientes (`apps/app`, Expo): Inicio, Buscar, buscar por foto, Vendedor, carrito, finalizar (QR, crédito o contra entrega), Mis pedidos, seguimiento y modo sin señal.
- App (30–31/10): entrar con el celular y un código (sin contraseña), direcciones con GPS, identidad lima/bosque/ámbar, encabezado compacto y el Inicio con vitrinas en carrusel («Más barato que en el súper», «Gana revendiendo», «Pruébalo con poco», «Más llevas, más ahorras», «Marcas de aquí»).
- Catálogo: 27 productos reales de Bolivia con foto, precio del súper (Fidalga y Amarket, 30/10) y marca boliviana verificada; `Producto.marca`, `marcaBoliviana` y `precioEnSuper`. Los genéricos de antes quedaron pausados.
  **Jhoel:** después de `git pull`, `pnpm todo` y `pnpm semilla`; en el emulador suma `adb reverse tcp:8082 tcp:8082` para ver las fotos.
- Abasto vende:
  - Catálogo: Abasto como vendedor de la casa y productos BAJO_PEDIDO con costo y proveedor (`catalogo:semilla-abasto`).
  - Pedidos: CONTRA_ENTREGA, listaDeCompras, avanzarEntrega y traccion (solo admin).
  - Panel: Compras (lista por puesto con margen) y Preparar/Despachar/Entregar en Pedidos.
  - Superadmin: Tracción.
  - Usuario ventas@abasto.bo (org abasto).
- App (31/10): elegir la dirección en Google Maps (pin fijo, calle al mover), la dirección viaja en el pedido (Pedidos, Seguimiento y Panel) y Finalizar en tres pasos. El carrito viejo se pone al día con el catálogo.
  **Jhoel:** la app suma react-native-maps (nativo): `npm install` en `apps/app`, tu clave de Maps en `apps/app/.env.local` (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`) y `npx expo run:android` una vez.
- CU-01 (31/10): registro público de mayoristas en el Panel (`/registro`), aviso «en revisión» o el motivo del rechazo en el Panel, y el módulo Mayoristas del Superadmin para verificar o rechazar. e2e `registro-mayorista.spec.ts`.
- Nicho nuevo (01/11): tiendas de barrio y negocios que cocinan. El Inicio cambia según el negocio (tienda, salteñería-panadería, pensión-restaurante), con «Tu pedido de la semana» y «No vuelvas a ir al mercado». Catálogo: 22 productos del nicho en presentación de mercado (quintal, arroba, balde, maple), rubros nuevos (Harinas y panificación, Aceites y grasas, Granos y cereales, Condimentos, Huevos y lácteos, Verduras secas, Descartables) y `Producto.precioPorConfirmar` para los precios de demostración. **Falta cotizarlos en el mercado.**
  **Jhoel:** `pnpm semilla` (o `catalogo:semilla-abasto`) para ver los 49 productos.
- App (01/11, pedido del usuario): «¿Qué negocio tienes?» pasó al registro (después del celular, antes de la dirección) y se cambia en Cuenta; el Inicio suma «También te puede servir» según el negocio; el banner del mercado quedó con poco texto y una ilustración 3D nueva.
- Herramientas por tipo de cliente (01/11, pedido de Andrés): plan en `docs/plan-mi-negocio.md`. **Fase 1 hecha:** tres tipos (Hogar, Tienda, Productor con subtipo), registro obligatorio con ilustraciones 3D nuevas, Inicio de cada uno y cambio en Cuenta. **Fases 1 a 6 hechas (02/11):** tipo de cliente, inventario que se llena solo, caja, fiado, el mes, recetas con planificador y tandas, cuentas de la casa y lista fija. **Todo queda en la base de datos** (tipo de negocio en Catálogo, lo demás en el esquema `negocio` de Cobros); el teléfono guarda solo sin señal y sube solo. Ver «Cómo quedó» en `docs/plan-mi-negocio.md`. **Jhoel:** después de `git pull`, `pnpm install`, `npm install` en `apps/app`, `pnpm todo` (reconstruye Cobros y Pedidos) y `node infra/keycloak/al-dia.mjs`.
- Catálogo real por área y primera receta (02/11, plan en `docs/plan-catalogo-real-y-plantillas.md`): 138 productos de Santa Cruz con imagen y `usos`; el Panel filtra y edita los usos; 6 áreas del productor; 20 plantillas de receta (`mi-negocio/plantillas.ts`); la receta se arma con insumos en cero; el registro sigue con «Arma tu primera receta» o «Arma tu primer estante»; el Inicio muestra solo lo de cada uno («Para tu receta de…», «Lo que más se pide en tu rubro»).
- App (02/11, pedido de Andrés): Vender con carrito flotante (la foto vuela, la hoja se abre sola con el primero); la pestaña Pedidos pasa a **Compras**, más directa; pedir con QR lleva directo al QR; seguimiento con línea de tiempo arriba, el paso actual latiendo y el QR dentro; festejo a pantalla completa al pagar. 10 fotos del catálogo rehechas e ilustraciones sin huecos.
- App (02/11, segundo pedido de Andrés): escenas 3D animadas por estado en Compras y en la cabecera del seguimiento (la moto yendo, el vendedor revisando, empacando…), línea de tiempo compacta, festejo del pago más fuerte con sonido y festejo de la entrega que carga los productos al inventario y lleva a Mi negocio con lo recién llegado resaltado. 5 ilustraciones nuevas (USD ~0,20).
  **Jhoel:** la app suma `expo-audio` (nativo): `npm install` en `apps/app` y `npx expo run:android` una vez. Sin eso la app anda igual, solo que sin sonido.
- App (02/11, tercer pedido): las escenas de Compras y del seguimiento pasan a **3D de verdad** (three.js + React Three Fiber sobre expo-gl, como el panel del taller): vendedor en su mostrador, cinta del depósito, moto por el barrio, QR en la tienda y entrega con confeti. Sin GL queda la escena ilustrada.
  **Jhoel:** la app suma `expo-gl`, `three` y `@react-three/fiber` (nativo): `npm install` en `apps/app` y `npx expo run:android` una vez.
- App (02/11, cuarto pedido): en Vender se puede anotar el cliente (opcional, un campo con buscador: nombre y celular, nunca se repite); «Nueva receta» ofrece escoger una receta lista; los botones de todas las hojas de Mi negocio quedan fijos abajo.
- e2e: 22 pruebas en verde (02/11).

## Cambié en contratos
- 03/11 · `contracts/microfrontends.md`: sección nueva «IA local del navegador en la PWA» (qué guarda el service worker y qué guarda la librería de IA). Aditivo: Inteligencia no tiene que cambiar nada.
- 02/11 · Catálogo: `Producto.usos: [String!]!` (a quién se muestra en el Inicio), `usos` en `CrearProductoEntrada` y `EditarProductoEntrada`, y `Mayorista.dePrueba: Boolean!`. Subtipos del productor: se suman `horneados`, `polleria` y `puesto`. Todo aditivo; subgrafo y supergrafo regenerados. **Jhoel:** nada que tocar; después de `git pull`, `pnpm semilla` para ver los 138 productos.
- 02/11 · Tiempo real: Conecta abre el WebSocket `/v1/tiempo-real` (OpenAPI de Conecta) y escucha `pedido.*` y `cobro.*` con una cola exclusiva propia. AsyncAPI: `cobro.qr_generado` (aditivo; Cobros lo publica al crear el QR). **Jhoel:** el proyector de Asistente recibe `cobro.qr_generado` y lo ignora (cae en `default`); no hay que tocar nada.
- 01/11 · «Mi negocio» en Cobros (esquema `negocio`): `miNegocio(desde)` y `sincronizarMiNegocio(cambios)` en el subgrafo de Cobros (supergrafo regenerado). AsyncAPI: `DatosPedido.lineas` (aditivo; Pedidos lo manda en todos los `pedido.*`) y la cola nueva `cobros.mi-negocio` (solo `pedido.entregado`). Keycloak: cuenta de servicio `cobros-servicio` (`infra/keycloak/al-dia.mjs`). **Jhoel:** el proyector de Asistente recibe `lineas` de más en `pedido.*`; no cambia nada de lo que ya lee.
- Cobros: cobroDePedido, pagarQrDePrueba, CobroQr y Pedido.cobro.
- Catálogo: Producto.abastecimiento/entregaHoras/costoUnitario/proveedor, Mayorista.deLaCasa e inputs de crear/editar.
- Pedidos: MetodoPago.CONTRA_ENTREGA, listaDeCompras, avanzarEntrega y traccion.
- AsyncAPI: contra_entrega y pedido.en_preparacion | despachado | entregado. OpenAPI de Conecta: CONTRA_ENTREGA.
- 01/11 · Catálogo: `Producto.precioPorConfirmar: Boolean!` (precio de demostración). Subgrafo y supergrafo regenerados.
- 01/11 · Catálogo: `NegocioDelCliente { tipo subtipo elegidoEn }`, query `miTipoDeNegocio`, mutation `elegirTipoDeNegocio(tipo, subtipo)` y el campo `negocio` en `MiOrganizacion` y en la entidad `Tienda`. Subgrafo y supergrafo regenerados.
- 01/11 · Ningún contrato nuevo para «Mi negocio»: la app ahora pide también `subtotal { centavos }` en las líneas de `misCompras` (el campo ya existía en `Dinero`).
- 31/10 · Pedidos: `CrearPedidoEntrada.entrega: DireccionEntrada` (opcional) y `Pedido.entrega: DireccionDeEntrega`; migración V3. OpenAPI de Conecta: `DatosPedido.entrega`.

## Necesito del otro
- Jhoel: `reconocerProducto(fotoUri)` en `apps/app/src/ia` con el modelo TFLite entrenado con las fotos del catálogo.

## Sigue
- CU-15: registro de tiendas desde la app.
- Registrar el cobro de los pedidos contra entrega y las cuentas por cobrar (CU-09).
- Investigar de dónde y cómo cargar el catálogo real.
