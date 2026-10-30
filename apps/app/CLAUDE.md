# Abasto · app de clientes · Expo (Android e iPhone) · dueño: Andrés (la IA de `src/ia/`: Jhoel)

La app con la que tiendas y personas compran al por mayor. Es el producto que vende; quien vende gestiona en el Panel web.
**Está fuera del workspace de pnpm: aquí se usa npm.**

- Pantallas en `src/pantallas`: Entrar, Inicio, Buscar, Producto, Vendedor, Carrito, Finalizar, Pedidos, Seguimiento (con el QR), BuscarPorFoto y Cuenta. Siguen la maqueta `docs/uix-mockup/Abasto v1 (1).html`.
- La lógica sin pantallas viene de `packages/comercio` (catálogo, precios por volumen, carrito y saga) y la bandeja offline de `packages/outbox-offline`, por ruta: `metro.config.js`, `tsconfig.json` y `jest.moduleNameMapper`.
- Sesión con Keycloak (`src/sesion.tsx`, cliente `abasto-app`, PKCE). Los tokens van al llavero (expo-secure-store) y se renuevan solos.
- Sin señal: el catálogo y el carrito quedan guardados (`src/guardado.ts`) y los pedidos salen por la bandeja (`src/bandeja-pedidos.ts`) hacia Conecta con una clave única.
- **IA local = `src/ia/` (dueño: Jhoel).** Ahí están ML Kit (`leer-texto.ts`), los modelos TFLite (`modelo.ts`, `assets/modelos/`), la lectura de precios (`precio.ts`) y el diagnóstico. Las pantallas importan **solo** desde `src/ia/index.ts` y nunca de un archivo de adentro. El resto de la app es de Andrés.
- Buscar con una foto: `leerTexto` (de `src/ia`) lee la etiqueta en el teléfono y `buscarPorTextoLeido` (`packages/comercio`) ordena el catálogo. Cuando esté el modelo propio, `src/ia` exportará también el reconocimiento del producto por cómo se ve.
- Lo que solo existe en el teléfono (ML Kit, TFLite, cámara) tiene un `.web.tsx` o `.web.ts` vacío para la vista web de desarrollo.

Correr:
- Vista web de desarrollo: `npm run web` → http://localhost:8090.
- Android (emulador Pixel 7 o teléfono por USB):
  1. La primera vez, o si cambia algo nativo: `npx expo run:android` (en Windows, mira «rutas largas» en el `CLAUDE.md` de la raíz).
  2. El resto de los días alcanza con `npm start`, que es Metro en el 8090 y recarga solo.
  3. `adb reverse` de 8180, 4000, 8084 y 8090 (Keycloak, Router, Conecta y Metro). Hay que repetirlo cada vez que se reinicia adb.
  4. Abrir la app apuntando a localhost: `adb shell am start -a android.intent.action.VIEW -d "exp+abasto://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8090" bo.abasto.app`.
  - **No uses `--localhost` en Metro.** En Windows escucha solo en `::1` (IPv6), adb entra por `127.0.0.1` y la app muestra «unexpected end of stream».
  - Usuario de prueba de una tienda: `donarosa@abasto.bo` / `abasto123`.
- iPhone: build de desarrollo con EAS o una Mac.

Probar: `npm test` y `npx tsc --noEmit`.
