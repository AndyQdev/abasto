/// <reference lib="webworker" />
/**
 * Service worker del Panel (PWA): el mayorista sigue trabajando aunque se caiga el internet del depósito.
 * - El Shell queda precacheado; los remotos (Gestión e Inteligencia) se guardan la primera vez que se abren.
 * - Las consultas GraphQL salen a la red y, sin señal, se contestan con la última respuesta guardada.
 * - Las mutaciones sin señal quedan en la bandeja (IndexedDB) y el Shell las manda al volver la señal.
 * - La IA local del navegador (Whisper hoy): su librería del CDN se guarda una vez; los modelos los guarda la
 *   librería en su propia caché y aquí no se tocan (offline/ia-local.ts).
 * Las reglas están en offline/graphql.ts y offline/ia-local.ts, que se prueban sin service worker.
 */
import { AlmacenIndexedDB, Bandeja } from '@abasto/outbox-offline';
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { BANDEJA_DEL_PANEL, ROUTER_URL } from './offline/config';
import {
  ESPERA_DE_RED_MS,
  claveDeConsulta,
  esMutacion,
  respuestaEnCola,
  respuestaSinDatos,
  type CuerpoGraphQL,
} from './offline/graphql';
import { CACHE_IA_LOCAL, esArchivoDeModelo, esLibreriaConVersion } from './offline/ia-local';

declare global {
  // El tsconfig del Shell usa la librería DOM, donde self es Window
  interface Window {
    __WB_MANIFEST: (string | { url: string; revision: string | null })[];
  }
}
const sw = self as unknown as ServiceWorkerGlobalScope;

// workbox-build busca este texto exacto para meter la lista de archivos del build
precacheAndRoute(self.__WB_MANIFEST);
// Una versión nueva toma el control enseguida (registerType autoUpdate)
void sw.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
// Cualquier ruta del Panel (/pedidos, /reportes...) abre el mismo index.html
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

const router = new URL(ROUTER_URL);
const CACHE_GRAPHQL = 'abasto-graphql';
// La bandeja en el service worker solo agrega: el que envía es el Shell, que tiene el token vigente
const bandeja = new Bandeja(new AlmacenIndexedDB(BANDEJA_DEL_PANEL), async () => []);

// Keycloak nunca se guarda: la sesión siempre se valida contra el servidor
registerRoute(({ url }) => url.port === '8180', new NetworkOnly());
registerRoute(({ url }) => url.pathname === '/remotos.json', new NetworkFirst({ cacheName: 'abasto-remotos', networkTimeoutSeconds: 3 }));
// IA local del navegador: la librería con versión fija no cambia nunca, se guarda una vez
registerRoute(({ url, request }) => request.method === 'GET' && esLibreriaConVersion(url), new CacheFirst({ cacheName: CACHE_IA_LOCAL }));
// Scripts y estilos de Gestión (5171) e Inteligencia (5172): se usan al instante y se actualizan de fondo.
// Los modelos (Hugging Face) quedan afuera: los guarda la librería de IA y aquí quedarían dos veces
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.origin !== sw.location.origin && url.origin !== router.origin && !esArchivoDeModelo(url),
  new StaleWhileRevalidate({ cacheName: 'abasto-remotos' }),
);

sw.addEventListener('fetch', (evento) => {
  const { request } = evento;
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.origin !== router.origin) return;
  evento.respondWith(graphql(request));
});

async function graphql(request: Request): Promise<Response> {
  const cuerpo = (await request.clone().json().catch(() => ({}))) as CuerpoGraphQL;
  if (esMutacion(cuerpo)) {
    try {
      return await fetch(request);
    } catch {
      await bandeja.agregar('graphql.mutacion', { ...cuerpo });
      await avisar({ tipo: 'abasto:en-cola' });
      return respuestaEnCola();
    }
  }

  const clave = await claveDeConsulta(cuerpo, request.headers.get('authorization'));
  const cache = await caches.open(CACHE_GRAPHQL);
  try {
    const respuesta = await conEspera(fetch(request), ESPERA_DE_RED_MS);
    if (respuesta.ok) await cache.put(clave, respuesta.clone());
    return respuesta;
  } catch {
    const guardada = await cache.match(clave);
    if (!guardada) return respuestaSinDatos();
    await avisar({ tipo: 'abasto:desde-cache' });
    return guardada;
  }
}

function conEspera<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promesa, new Promise<T>((_, falla) => setTimeout(() => falla(new Error('La red tardó demasiado')), ms))]);
}

async function avisar(mensaje: { tipo: string }) {
  for (const cliente of await sw.clients.matchAll({ type: 'window' })) cliente.postMessage(mensaje);
}
