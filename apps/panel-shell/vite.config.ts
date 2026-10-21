import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { port: 5170, strictPort: true },
  test: { environment: 'jsdom' },
});
