import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

/**
 * Microfrontend de Inteligencia. Todos los componentes se compilan como Custom Element (Shadow DOM, estilos adentro).
 * En desarrollo el Shell importa /src/remoto.ts; en producción, dist/remoteEntry.js.
 */
export default defineConfig({
  plugins: [vue({ customElement: true })],
  server: { port: 5172, strictPort: true, cors: true },
  build: {
    lib: { entry: 'src/remoto.ts', formats: ['es'], fileName: () => 'remoteEntry.js' },
    target: 'es2022',
  },
  define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production') },
  test: { environment: 'jsdom' },
});
