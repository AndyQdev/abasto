/**
 * Dónde están los servicios. En el emulador o el teléfono por USB, `adb reverse` hace que localhost
 * sea la computadora (ver apps/app/CLAUDE.md); para un teléfono en la calle, las URL del túnel HTTPS.
 */
export const URLS = {
  keycloak: process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? 'http://localhost:8180/realms/abasto',
  router: process.env.EXPO_PUBLIC_ROUTER_URL ?? 'http://localhost:4000/',
  conecta: process.env.EXPO_PUBLIC_CONECTA_URL ?? 'http://localhost:8084',
};

export const CLIENTE_KEYCLOAK = 'abasto-app';
