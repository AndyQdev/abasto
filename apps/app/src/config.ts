import { NativeModules } from 'react-native';

/**
 * Dónde están los servicios.
 * - Emulador o teléfono por USB: `adb reverse` hace que localhost sea la computadora (ver apps/app/CLAUDE.md).
 * - Un teléfono en el mismo wifi (el iPhone con Expo Go): la app se cargó desde la IP de la computadora, así que usa
 *   esa misma IP para los servicios. Sale sola de la dirección del bundle: cambiar de wifi no rompe nada.
 *   `EXPO_PUBLIC_HOST_DE_LA_RED` la fuerza si hace falta.
 * - Un teléfono en la calle: las URL del túnel HTTPS (EXPO_PUBLIC_*_URL).
 */
function hostDelBundle(): string | null {
  if (!__DEV__) return null;
  const fuente = NativeModules?.SourceCode as { scriptURL?: string; getConstants?: () => { scriptURL?: string } } | undefined;
  const url = fuente?.scriptURL ?? fuente?.getConstants?.().scriptURL;
  const host = url?.match(/^https?:\/\/([^/:]+)/)?.[1];
  return host && host !== 'localhost' && host !== '127.0.0.1' ? host : null;
}

const HOST_DE_LA_RED = process.env.EXPO_PUBLIC_HOST_DE_LA_RED ?? hostDelBundle();
const local = (puerto: number, ruta = '') => `http://${HOST_DE_LA_RED ?? 'localhost'}:${puerto}${ruta}`;

export const URLS = {
  keycloak: process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? local(8180, '/realms/abasto'),
  router: process.env.EXPO_PUBLIC_ROUTER_URL ?? local(4000, '/'),
  conecta: process.env.EXPO_PUBLIC_CONECTA_URL ?? local(8084),
};

export const CLIENTE_KEYCLOAK = 'abasto-app';

/** Catálogo arma las fotos con localhost: en el wifi se cambia por la IP de la computadora */
export const urlDeLaRed = (url: string) => (HOST_DE_LA_RED ? url.replace(/\/\/(localhost|127\.0\.0\.1):/, `//${HOST_DE_LA_RED}:`) : url);
