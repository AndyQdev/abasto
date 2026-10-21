import { execSync } from 'node:child_process';

/** Antes de las pruebas: datos de demostración de reportes con fechas relativas a hoy. */
export default function preparar() {
  execSync('pnpm --filter @abasto/asistente semilla', { cwd: '..', stdio: 'inherit' });
}
