import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/**
 * Abasto Mercado es una PWA: se instala en el celular y abre sin señal.
 * Workbox guarda la app; los datos de la tienda (catálogo, carrito, bandeja) viven en el navegador.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Abasto Mercado',
        short_name: 'Abasto',
        description: 'Compra al por mayor a tus mayoristas, aunque no tengas señal.',
        lang: 'es-BO',
        start_url: '/',
        display: 'standalone',
        theme_color: '#1A7554',
        background_color: '#EEF3F0',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  test: { environment: 'jsdom' },
});
