import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PEDIDOS_DEMO = '../services/pedidos/src/main/resources/db/demo/R__datos_demo.sql';

/**
 * Antes de las pruebas:
 * - datos de demostración de reportes con fechas relativas a hoy;
 * - los pedidos de demostración otra vez «por confirmar»: su plazo vence a las 2 horas y
 *   el revisor de plazos de Pedidos los rechaza si el sistema lleva más tiempo levantado;
 * - Doña Rosa vuelve a no ser cliente de La Ramada, porque la prueba de la red privada la aprueba.
 */
export default function preparar() {
  execSync('pnpm --filter @abasto/asistente semilla', { cwd: '..', stdio: 'inherit' });

  const demo = "pedido_id IN (SELECT id FROM pedidos WHERE id::text LIKE '7b0d4f3e-0001-%')";
  const sql = [
    'BEGIN;',
    `DELETE FROM sagas_de_compra WHERE ${demo};`,
    `DELETE FROM lineas_de_pedido WHERE ${demo};`,
    "DELETE FROM pedidos WHERE id::text LIKE '7b0d4f3e-0001-%';",
    readFileSync(new URL(PEDIDOS_DEMO, import.meta.url), 'utf8'),
    'COMMIT;',
  ].join('\n');
  execSync('docker compose exec -T postgres psql -U abasto -d pedidos -q -v ON_ERROR_STOP=1', { cwd: '..', input: sql, stdio: ['pipe', 'inherit', 'inherit'] });

  execSync(`docker compose exec -T mongo mongosh catalogo --quiet --eval "db.relaciones.deleteOne({ _id: 'dr|lr' })"`, {
    cwd: '..',
    stdio: 'inherit',
  });

  // Abasto como vendedor de la casa, con su catálogo bajo pedido (modelo de lanzamiento)
  execSync('docker compose exec -T catalogo php artisan catalogo:semilla-abasto', { cwd: '..', stdio: 'inherit' });
}
