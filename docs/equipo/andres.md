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

Actualizado: 10/11/2026 · en main (los dos trabajamos ahí)

## Estoy en
Los 16 casos de uso tienen pantalla, prueba y sus diagramas ICONIX. Ni el Panel ni el Superadmin tienen módulos en construcción. Falta lo que depende de afuera o de una decisión (ver «Sigue»).

## Terminé
- **Notificaciones push (10/11, pedido del ingeniero; `docs/notificaciones.md`):**
  - **Pedidos:** cada paso del pedido le avisa al teléfono de la tienda (confirmado, en preparación, en camino, entregado, rechazado, pago con QR, reclamo respondido). Una notificación por pedido: cada paso reemplaza al anterior. **«Va en camino» queda fija** hasta que llega, como en las apps de delivery.
  - **Superadmin › Promociones:** le llega a todos los que tienen la app, con vista previa del teléfono y el producto que abre.
  - **Cómo está armado:**
    - Conecta escucha `conecta.notificaciones` y manda por Firebase (API v1, sin SDK). Guarda los teléfonos en DynamoDB.
    - No repite: `AVISO#<evento>` y `Idempotency-Key` en las promociones.
    - La app pide el permiso, registra el token, abre la pantalla correcta al tocar y pone o quita la fija.
  - **Sin la cuenta de Firebase** queda en modo prueba: se anota y no sale. Hace falta `apps/app/google-services.json` y `.firebase/firebase.json` (los dos ignorados por git).
  - **Pruebas:** Conecta 79, app 191, Superadmin 35 y e2e `notificaciones.spec.ts` (los cuatro avisos de un pedido y una promoción desde el Superadmin).
- **Reportes como chat con mesa de trabajo (10/11, pedido de Andrés; Jhoel: es tu carpeta, te cuento):**
  - **Qué cambió:** Inteligencia › Reportes ahora es un chat con el Analista. A la izquierda la conversación (texto o voz); a la derecha la mesa de trabajo, con una pestaña por reporte. La lógica del Asistente no cambió: mismo `POST /v1/reportes/preguntas`, mismo contrato.
  - **Plantillas:** el reporte se arma según la forma de la respuesta (`reportes/conversacion.ts`, `plantillaDe`):
    - una sola fila con números, en grande;
    - barras o línea, con su resumen (el total solo si son bolivianos);
    - tabla;
    - un aviso cuando el Analista no tiene datos.
  - **Más cambios en Reportes:** la pregunta ambigua sale en el chat con sus botones, y la misma pregunta otra vez actualiza su pestaña. La conversación sobrevive a cambiar de pantalla (`sessionStorage`); lo guardado sin señal sigue igual.
  - **Voz en vivo:**
    - `voz/escucha.ts` junta el audio con un AudioWorklet y detecta solo cuándo te callas; `grabadora.ts` ya no existe.
    - `usar-voz.ts` transcribe con Whisper mientras hablas y la burbuja muestra lo entendido. Al callarte (o con «Listo»), la pregunta sale sola.
    - Si el modelo ya está en el equipo, se carga y se calienta al abrir Reportes.
    - `max_new_tokens: 64` y un filtro de las frases que Whisper inventa con silencio («Subtítulos realizados por la comunidad de Amara.org», «Gracias.»).
    - Probado en Chrome con una frase hablada real: «cuáles son mis cinco productos más vendidos» se transcribió bien y salió sola.
    - **Ojo, velocidad:** en mi laptop Whisper tardó de 3 a 11 s por frase (un solo hilo, porque la página no tiene aislamiento de origen). En equipos lentos solo transcribe en las pausas, para no atrasar la respuesta.
  - **Arreglo tuyo de paso:** `ErrorDelAsistente` en `sesion.ts` usaba una propiedad en el constructor (`readonly opciones`), que `erasableSyntaxOnly` no deja: `vue-tsc -b` (y `pnpm build`) fallaba. La declaré aparte; hace lo mismo.
  - **Gráfico:** con `tienda_id` y `tienda_nombre`, las barras ahora dicen el nombre y no «ec» (`graficos/serie.ts`).
  - **Pruebas:** 82 en Inteligencia y el e2e `panel.spec.ts` (ahora escribe la pregunta en el chat).
- **WhatsApp por n8n (06/11):** el flujo no le podía comprar a Abasto: pedía códigos de 4 dígitos (`AB-101` tiene 3), fiaba por defecto y su mayorista por defecto era uno de prueba. Ahora compra a Abasto contra entrega, y la prueba `n8n-whatsapp.spec.ts` lo verifica contra el n8n real.
- **CU-16 · Reclamos (06/11, decisión de Andrés):** la tienda reporta un problema desde Seguimiento, Abasto lo resuelve a mano en Superadmin › Reclamos y el sistema solo anota lo devuelto. No mueve Cobros. El mayorista ve la marca en su pedido del Panel.
- **CU-10 · Conectar un e-commerce (06/11):** llaves de API (cada una es una cuenta de Keycloak con el `org_id` de la tienda), avisos firmados con reintentos, MCP de compras `abasto-compras` y plugin de WooCommerce (`plugins/woocommerce-abasto`), probado contra WordPress 7.1 y WooCommerce 11.2 reales. Pantalla en App › Cuenta › Conectar mi tienda en línea.
  **Jhoel:** después de `git pull`, `pnpm install`, `pnpm todo` (crea `conecta-integraciones` en Keycloak y la cola `conecta.webhooks`) y `docker compose --profile servicios restart catalogo`. Tu MCP de reportes no cambió.
- **Bug de seguridad (06/11):** Pedidos devolvía el pedido de otra tienda si alguien reusaba su clave de idempotencia. Ahora responde `CLAVE_EN_USO`, y Conecta guarda las claves por empresa.
- **CU-04 · Dar crédito (06/11):** hasta ahora las líneas solo existían en la semilla. Se da al aprobar o desde la tarjeta del cliente, en Panel › Clientes. `lineaDeCredito` ya no la puede leer cualquier sesión.
- **Superadmin (06/11):** Tiendas (suspender de verdad frena sus pedidos), Reportes, Integraciones y Usuarios (solo lectura). Los gráficos de Tracción mentían: 78 y 103 se veían casi iguales; arreglado. Se usa bien en el teléfono.
- **CU-15 (06/11):** ya estaba resuelto por «entrar con el celular» (30/10). Le faltaba su prueba de punta a punta: `e2e/pruebas/registro-tienda.spec.ts`.
- **Agua en las recetas (06/11):** queda como `Receta.notas` («Además lleva 2,7 L de agua») y se ve al cocinar.
- **ICONIX (06/11):** los 16 casos con texto, robustez y secuencia; los 32 diagramas pasan el analizador de Mermaid.
- **Conecta en el Panel (F3, 03/11):** la bitácora de lo que entra de afuera (WhatsApp por n8n, tienda en línea por la API, app sin señal) con lo que pasó con cada cosa, incluido «Repetido: no se duplicó» (idempotencia a la vista). Conecta: `GET /v1/bitacora` y la cabecera `X-Abasto-Origen` (OpenAPI, aditivo); el flujo de n8n la manda. e2e `conecta.spec.ts`.
- **Bug arreglado (03/11):** un pedido con un producto que no existe en Catálogo dejaba vacío Panel › Pedidos (el Router anulaba toda `misVentas`). Catálogo ahora resuelve ese producto como «Producto que ya no está en el catálogo (código)».
- **CU-09 · Cuentas por cobrar (03/11):** Cobros abre una cuenta por cada pedido a crédito o contra entrega al confirmarse (`pedido.confirmado`, cola `cobros.cuentas`); el Panel › Cuentas muestra lo que te deben (lo más atrasado primero) y registra pagos en efectivo, transferencia o QR, todo o una parte. Un pago repetido no se cuenta dos veces y al saldar un crédito la tienda recupera el cupo. e2e `cuentas.spec.ts` (confirmar A-1051 → la cuenta aparece → dos pagos → pagada); la suite completa en verde (arreglé `mi-negocio.spec.ts`, que todavía buscaba la tabla vieja de Pedidos).
  **Jhoel:** ahora Cobros publica `cobro.pago_registrado` con `{ pedidoId, codigo, tiendaId, mayoristaId, centavos, forma, saldoCentavos }` (`contracts/asyncapi.yaml`); tu proyector ya lo aplicaba y lo probé: A-1051 queda `pagada` en `reportes.cuentas_por_cobrar`. Una diferencia que conviene igualar: tu proyector pone 15 días de plazo a todo crédito y Cobros usa el plazo de la línea (15 o 30); si quieres, toma `saldoCentavos` del evento en vez de restar. Después de `git pull`: `pnpm supergrafo` no hace falta (lo subí), `docker compose --profile servicios up -d --build cobros` y `docker compose restart router`.
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
- 10/11 · Conecta (OpenAPI, aditivo): `PUT /v1/dispositivos`, `DELETE /v1/dispositivos/{token}`, `POST /v1/dispositivos/prueba`, `GET|POST /v1/admin/promociones` y `GET /v1/admin/notificaciones`. AsyncAPI: la cola nueva `conecta.notificaciones` (solo consume `pedido.*` y `cobro.*`, no cambia ningún mensaje; también en `infra/rabbitmq/definitions.json`). Catálogo: `misProductos` también responde al rol admin (los productos de su empresa), para elegir el producto de una promoción. **Jhoel:** en AWS, para que salgan de verdad, copiar la cuenta de servicio de Firebase a `infra/despliegue/aws/secretos/firebase.json` y `docker compose up -d --build conecta` (`compose.yml` ya la monta). Tu proyector no cambia.
- 06/11 · Pedidos (CU-16, aditivo): `abrirReclamo`, `resolverReclamo`, `reclamos(estado)` y `Pedido.reclamo`; migración V4; supergrafo regenerado. AsyncAPI: `pedido.reclamo_abierto` y `pedido.reclamo_resuelto`. **Jhoel:** tu proyector los recibe y los ignora (caen en `default`); no hay que tocar nada. Si quieres contar reclamos en Reportes, ahí están.
- 06/11 · Catálogo: `tiendas`, `equipoDeAbasto`, `suspenderTienda`, `reactivarTienda` (solo admin). Pedidos: `SemanaDeVentas.tiendas`. Aditivo; supergrafo regenerado. **Jhoel:** el Catálogo corre su escucha dentro del contenedor: después de `git pull`, `docker compose --profile servicios restart catalogo` para que tome el código nuevo.
- 06/11 · Conecta (OpenAPI, aditivo, CU-10): llaves de API (`/v1/llaves`), webhooks (`/v1/webhooks`, `/v1/entregas`), lectura para el e-commerce (`/v1/mayoristas`, `/v1/productos`, `/v1/pedidos/{id}`), administración (`/v1/admin/...`) y `POST /mcp`. `X-Abasto-Origen` suma `mcp`. Cola nueva `conecta.webhooks`. **Jhoel:** después de `git pull`, `pnpm install`, `pnpm todo` (corre `al-dia.mjs`, crea `conecta-integraciones`). El MCP de reportes sigue siendo tuyo, en Asistente; no toqué nada. Falta el origen `mcp` en tu proyector solo si quieres contarlo aparte.
- 06/11 · Pedidos: `crearPedido` rechaza con `CLAVE_EN_USO` una clave que ya usó otra tienda (antes devolvía el pedido ajeno).
- 06/11 · CU-04: Cobros `asignarCredito(entrada)` y `misCreditosDados`; Catálogo `misClientes`. `lineaDeCredito` ahora solo la leen la tienda y el mayorista de esa línea (antes cualquier sesión). Aditivo; supergrafo regenerado.
- 03/11 · Conecta (OpenAPI, aditivo): `GET /v1/bitacora` y la cabecera opcional `X-Abasto-Origen` en `POST /v1/pedidos`; la respuesta de `pedido.crear` trae además `codigo` y `tienda { nombre }`.
- 03/11 · Cobros (CU-09): `cuentasPorCobrar(conPagadas)`, `registrarPago(entrada)` y sus tipos (aditivo; supergrafo regenerado). AsyncAPI: payload de `cobro.pago_registrado` y la cola nueva `cobros.cuentas` (solo `pedido.confirmado`), también en `infra/rabbitmq/definitions.json`.
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
- Jhoel (09/11): corrí `evaluar` con Gemini: **19/20**, meta cumplida. La que falla es «las ventas de cada día de los últimos 7 días»: Gemini usa `fecha >= current_date - interval '7 days'` y trae 8 días. Se arregla con una regla en `instrucciones` («los últimos N días incluyen hoy: `fecha > current_date - N`»). Local y nube responden igual, en 2 a 5 s.
- Jhoel (09/11): el APK con las direcciones de la nube. El único que hay es de prueba, del 02/11, y necesita la computadora. Si no llegas, dime y lo compilo yo.

## Sigue
Depende de afuera:
- Conectar WhatsApp de verdad: el código de entrada (`EnviadorDeCodigos`, hoy lo muestra la app) y el flujo de pedidos de n8n (usa la tienda de prueba).
- Conectar un banco para el QR (hoy `pagarQrDePrueba`).
- Cotizar en el mercado los precios que siguen «Por confirmar».

Decidido por Andrés (06/11), no se hace por ahora:
- Día fijo de entrega por zona: cuando haya zonas reales.
- Roles finos en el Superadmin y margen por defecto editable por negocio.
