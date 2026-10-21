# Abasto Campo · Expo · solo Android · dueño: Jhoel

La app del mayorista en la calle: toma pedidos y carga productos sin internet. **Está fuera del workspace de pnpm: aquí se usa npm.**

- Lo que se hace sin señal va a la bandeja (`bandeja.ts`, SQLite) con una clave única. Cuando vuelve la señal se manda en lote a Conecta, que no duplica aunque se reintente.
- `precio.ts` aplica la lista de la tienda. `sesion.ts` entra con Keycloak (expo-auth-session, cliente `abasto-campo`).
- En el emulador o con el teléfono por USB: `adb reverse tcp:8180 tcp:8180` y `adb reverse tcp:8084 tcp:8084` para llegar a Keycloak y Conecta.

Correr: `npm install && npx expo start`. Probar: `npm test` y `npx tsc --noEmit`.
