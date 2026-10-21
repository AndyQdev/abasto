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
    { command: 'pnpm --filter @abasto/panel-shell dev', url: 'http://localhost:5170', reuseExistingServer: true, cwd: '..' },
    { command: 'pnpm --filter @abasto/panel-gestion dev', url: 'http://localhost:5171', reuseExistingServer: true, cwd: '..', timeout: 180_000 },
    { command: 'pnpm --filter @abasto/panel-inteligencia dev', url: 'http://localhost:5172', reuseExistingServer: true, cwd: '..' },
    { command: 'pnpm --filter @abasto/mercado dev', url: 'http://localhost:5173', reuseExistingServer: true, cwd: '..' },
  ],
});
