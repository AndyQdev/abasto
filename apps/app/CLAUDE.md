# Abasto · app de clientes · Expo (Android e iPhone) · dueño: Andrés (la IA de `src/ia/`: Jhoel)

La app con la que tiendas y personas compran al por mayor. Es el producto que vende; quien vende gestiona en el Panel web.
**Está fuera del workspace de pnpm: aquí se usa npm.**

- Pantallas en `src/pantallas`: Entrar, Inicio, Buscar, Producto, Vendedor, Carrito, Finalizar, Pedidos, Seguimiento (con el QR), BuscarPorFoto y Cuenta. Siguen la maqueta `docs/uix-mockup/Abasto v1 (1).html`.
- La lógica sin pantallas viene de `packages/comercio` (catálogo, precios por volumen, carrito y saga) y la bandeja offline de `packages/outbox-offline`, por ruta: `metro.config.js`, `tsconfig.json` y `jest.moduleNameMapper`.
- **Entrar como en PedidosYa (30/10, decisión del usuario): nada de correo ni contraseña.** `src/pantallas/Acceso.tsx`: celular → código de 6 dígitos → nombre (solo la primera vez). Lo resuelve Catálogo (`pedirCodigo` y `entrarConCodigo`, públicas en el Router; `src/acceso.ts`). Mientras no está WhatsApp, el código vuelve en la respuesta y la app lo muestra («Modo prueba»). La sesión es offline (Keycloak) y se renueva sola (`src/keycloak.ts`): la app no vuelve a pedir el celular. Nunca abrir el navegador para entrar.
- **Inicio (31/10, pedido del usuario, referencia `pedidosYa/image7.png`):** encabezado compacto (logo, dirección y campana en una fila, buscador encima del borde), rubros y la grilla de 3 columnas con lo que vende Abasto, del precio por unidad más bajo al más alto (`preciosDeLaCasa`). Cada tarjeta muestra el precio de la presentación más grande («Bs 5,80 c/u llevando 24»): al entrar se ven las demás. Sin banners ni saludo. A los afiliados nunca se los ordena por precio (red privada).
- **Fotos reales de los productos:** las sirve Catálogo (`Producto.foto`, `/fotos/...` en el 8082); `fotoDe(p)` cae a la ilustración del rubro si no hay. Van sobre blanco.
- **Direcciones:** la primera vez, «¿Dónde te lo llevamos?» (`src/pantallas/Ubicacion.tsx`, GPS de alta precisión + nombre de la calle, o a mano). Arriba en el Inicio, el selector con las guardadas; al abrir la app sale «Confirma tu dirección» (`src/HojaDeDirecciones.tsx`). Viven en el teléfono (`src/direcciones*.ts`).
- **Ilustraciones Gibby** en `assets/ilustraciones` (WebP), declaradas en `ilustraciones.json` y generadas una sola vez con `node --env-file=.env.local scripts/ilustraciones/generar.mjs --manifiesto apps/app/ilustraciones.json --crudas .ilustraciones-crudas` + `python -I scripts/ilustraciones/preparar.py ...` (la clave VERTEX_API_KEY va en `.env.local` de la raíz, nunca en git). Se revisan a ojo antes de usarlas.
- **Identidad (30/10, la eligió el usuario, referencia `pedidosYa/image4.png`):** lima `#C9F45A` (botones principales y lo elegido, siempre con texto bosque), bosque `#182D25` (encabezado, textos y botones de cierre: `Boton tipo="oscuro"`), ámbar `#FFB454` (descuentos) y fondo `#F2F7EB`. **No mezclar menta con lima.** Plus Jakarta Sans (`FUENTE` en `src/tema.ts`; `Texto` elige el archivo según el grosor). Las ilustraciones son objetos 3D recortados que flotan y sobresalen. Al agregar, la miniatura vuela al carrito (`src/vuelo.tsx`).
- **Efectos** en `src/animacion.tsx` (Animated de React Native, sin librerías nativas): Tocable (se hunde y vibra), Aparecer, Flotar (el 3D sube y baja), latido, Esqueleto, HojaInferior y sacudida.
- Sin señal: el catálogo y el carrito quedan guardados (`src/guardado.ts`) y los pedidos salen por la bandeja (`src/bandeja-pedidos.ts`) hacia Conecta con una clave única.
- **IA local = `src/ia/` (dueño: Jhoel).** Ahí están ML Kit (`leer-texto.ts`), los modelos TFLite (`modelo.ts`, `assets/modelos/`), la lectura de precios (`precio.ts`) y el diagnóstico. Las pantallas importan **solo** desde `src/ia/index.ts` y nunca de un archivo de adentro. El resto de la app es de Andrés.
- Buscar con una foto: `leerTexto` (de `src/ia`) lee la etiqueta en el teléfono y `buscarPorTextoLeido` (`packages/comercio`) ordena el catálogo. Cuando esté el modelo propio, `src/ia` exportará también el reconocimiento del producto por cómo se ve.
- Lo que solo existe en el teléfono (ML Kit, TFLite, cámara) tiene un `.web.tsx` o `.web.ts` vacío para la vista web de desarrollo.

Correr:
- Vista web de desarrollo: `npm run web` → http://localhost:8090.
- Android (emulador Pixel 7 o teléfono por USB):
  1. La primera vez, o si cambia algo nativo: `npx expo run:android` (en Windows, mira «rutas largas» en el `CLAUDE.md` de la raíz).
  2. El resto de los días alcanza con `npm start`, que es Metro en el 8090 y recarga solo.
  3. `adb reverse` de 8180, 4000, 8082, 8084 y 8090 (Keycloak, Router, las fotos de Catálogo, Conecta y Metro). Hay que repetirlo cada vez que se reinicia adb.
  4. Abrir la app apuntando a localhost: `adb shell am start -a android.intent.action.VIEW -d "exp+abasto://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8090" bo.abasto.app`.
  - **No uses `--localhost` en Metro.** En Windows escucha solo en `::1` (IPv6), adb entra por `127.0.0.1` y la app muestra «unexpected end of stream».
  - Para entrar: cualquier celular que empiece con 6 o 7 (8 dígitos) y el código que muestra la app en «Modo prueba».
  - GPS del emulador: `adb emu geo fix -63.1812 -17.7826` (Santa Cruz) mientras la app busca la ubicación.
  - Si «not enough space» al instalar: `adb shell pm uninstall-system-updates com.google.android.youtube` (y Fotos, Docs, Chrome…) libera ~1 GB.
  - Desde Git Bash, adb se cuelga: usarlo desde PowerShell.
- iPhone: build de desarrollo con EAS o una Mac.

Probar: `npm test` y `npx tsc --noEmit`.
