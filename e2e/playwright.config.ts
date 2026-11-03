import { defineConfig, devices } from '@playwright/test';

/**
 * Punta a punta contra el sistema real: `pnpm todo` levanta la infraestructura y los servicios;
 * Playwright levanta los frontends (o usa los que ya estén corriendo).
 */
export default defineConfig({
  testDir: './pruebas',
  globalSetup: './preparar.ts',
  timeout: 60_000,
  fullyParallel: false,
  // Un solo proceso: varios archivos crean pedidos y refrescan la misma lista del Panel; en paralelo se pisan
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-BO',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    // El Shell va construido (PWA): solo el build tiene service worker. Si ya corre pnpm dev:panel, se usa ese
    { command: 'pnpm --filter @abasto/panel-shell pwa', url: 'http://localhost:5170', reuseExistingServer: true, cwd: '..', timeout: 180_000 },
    { command: 'pnpm --filter @abasto/panel-gestion dev', url: 'http://localhost:5171', reuseExistingServer: true, cwd: '..', timeout: 180_000 },
    { command: 'pnpm --filter @abasto/panel-inteligencia dev', url: 'http://localhost:5172', reuseExistingServer: true, cwd: '..' },
    { command: 'pnpm --filter @abasto/superadmin dev', url: 'http://localhost:5174', reuseExistingServer: true, cwd: '..' },
  ],
});
