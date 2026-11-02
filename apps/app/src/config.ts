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

/**
 * Un teléfono en el mismo wifi sin `adb reverse` (el iPhone con Expo Go) llega a la computadora por su IP:
 * `EXPO_PUBLIC_HOST_DE_LA_RED=192.168.0.4`. Catálogo arma las fotos con localhost, así que se cambia aquí.
 */
const HOST_DE_LA_RED = process.env.EXPO_PUBLIC_HOST_DE_LA_RED;
export const urlDeLaRed = (url: string) => (HOST_DE_LA_RED ? url.replace(/\/\/(localhost|127\.0\.0\.1):/, `//${HOST_DE_LA_RED}:`) : url);
