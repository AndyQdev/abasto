import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * En desarrollo, /sw.js es un service worker que se borra solo. Si en el navegador quedó el del build
 * (pnpm pwa usa el mismo puerto 5170), el navegador lo actualiza a este, que limpia todo y recarga:
 * así nunca se queda mostrando el Shell viejo.
 */
const SW_QUE_SE_BORRA = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const clave of await caches.keys()) await caches.delete(clave);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));`;

function borrarServiceWorkerEnDesarrollo(): Plugin {
  return {
    name: 'abasto-borrar-sw-en-desarrollo',
    apply: 'serve',
    configureServer(servidor) {
      servidor.middlewares.use('/sw.js', (_req, res) => {
        res.setHeader('content-type', 'application/javascript');
        res.setHeader('cache-control', 'no-store');
        res.end(SW_QUE_SE_BORRA);
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    borrarServiceWorkerEnDesarrollo(),
    // PWA: el Panel se instala y sigue andando sin señal (ver src/sw.ts). El service worker solo
    // existe en el build: pnpm --filter @abasto/panel-shell pwa
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,json,png}'] },
      manifest: {
        name: 'Abasto · Panel Mayorista',
        short_name: 'Abasto Panel',
        description: 'Gestiona tus productos, clientes y pedidos, también sin señal.',
        lang: 'es-BO',
        start_url: '/',
        display: 'standalone',
        // Identidad v7 «Halo»: verde bosque y fondo crema
        theme_color: '#182D25',
        background_color: '#F2F7EB',
        icons: [
          { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icono-mascara-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  server: { port: 5170, strictPort: true },
  preview: { port: 5170, strictPort: true },
  test: { environment: 'jsdom' },
});
