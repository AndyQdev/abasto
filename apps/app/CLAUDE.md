# Abasto · app de clientes · Expo (Android e iPhone) · dueño: Andrés

La app con la que tiendas y personas compran al por mayor. Es el producto que vende; quien vende gestiona en el Panel web.
**Está fuera del workspace de pnpm: aquí se usa npm.**

- Pantallas en `src/pantallas`: Entrar, Inicio, Buscar, Producto, Vendedor, Carrito, Finalizar, Pedidos, Seguimiento (con el QR), BuscarPorFoto y Cuenta. Siguen la maqueta `docs/uix-mockup/Abasto v1 (1).html`.
- La lógica sin pantallas viene de `packages/comercio` (catálogo, precios por volumen, carrito y saga) y la bandeja offline de `packages/outbox-offline`, por ruta: `metro.config.js`, `tsconfig.json` y `jest.moduleNameMapper`.
- Sesión con Keycloak (`src/sesion.tsx`, cliente `abasto-app`, PKCE). Los tokens van al llavero (expo-secure-store) y se renuevan solos.
- Sin señal: el catálogo y el carrito quedan guardados (`src/guardado.ts`) y los pedidos salen por la bandeja (`src/bandeja-pedidos.ts`) hacia Conecta con una clave única.
- Buscar con una foto: ML Kit lee la etiqueta en el teléfono (`src/leer-texto.ts`) y `buscarPorTextoLeido` ordena el catálogo.
- Lo que solo existe en el teléfono (ML Kit, TFLite, cámara) tiene un `.web.tsx` o `.web.ts` vacío para la vista web de desarrollo.

Correr:
- Vista web de desarrollo: `npm run web` → http://localhost:8090.
- Android (emulador Pixel 7 o teléfono por USB): `npx expo run:android`, y después `adb reverse tcp:8180 tcp:8180`, `adb reverse tcp:4000 tcp:4000` y `adb reverse tcp:8084 tcp:8084` para llegar a Keycloak, al Router y a Conecta.
- iPhone: build de desarrollo con EAS o una Mac.

Probar: `npm test` y `npx tsc --noEmit`.
