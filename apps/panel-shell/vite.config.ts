import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    // PWA: el Panel se instala y sigue andando sin señal (ver src/sw.ts). El service worker solo
    // existe en el build: pnpm --filter @abasto/panel-shell pwa
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,json}'] },
      manifest: {
        name: 'Abasto · Panel Mayorista',
        short_name: 'Abasto Panel',
        description: 'Gestiona tus productos, clientes y pedidos, también sin señal.',
        lang: 'es-BO',
        start_url: '/',
        display: 'standalone',
        theme_color: '#197052',
        background_color: '#ffffff',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  server: { port: 5170, strictPort: true },
  preview: { port: 5170, strictPort: true },
  test: { environment: 'jsdom' },
});
