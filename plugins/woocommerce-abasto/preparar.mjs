// Deja un WordPress con WooCommerce y el plugin de Abasto activo para probarlo (`pnpm woocommerce`).
// Se puede correr las veces que haga falta. Las contraseñas son solo de esta prueba local.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));
const compose = ['compose', '-f', resolve(raiz, 'docker-compose.yml'), '-p', 'abasto-woo'];
const puerto = process.env.PUERTO_WOO ?? '8095';
// Con este nombre lo alcanzan el navegador de la máquina y Conecta (que está en otro contenedor)
const url = `http://host.docker.internal:${puerto}`;

const docker = (...args) => execFileSync('docker', [...compose, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const wp = (...args) => docker('run', '--rm', 'woo-cli', 'wp', ...args).trim();
const siFalla = (hacer, valor = null) => {
  try {
    return hacer();
  } catch {
    return valor;
  }
};

docker('up', '-d', '--wait', 'woo');

// WordPress termina de copiar sus archivos al volumen poco después de arrancar
for (let intento = 1; ; intento++) {
  if (siFalla(() => docker('run', '--rm', 'woo-cli', 'wp', 'core', 'version'))) break;
  if (intento > 30) throw new Error('WordPress no terminó de arrancar');
  await new Promise((r) => setTimeout(r, 2000));
}

if (siFalla(() => wp('core', 'is-installed'), 'no') === 'no') {
  wp('core', 'install', `--url=${url}`, '--title=Mi tienda de prueba', '--admin_user=admin', '--admin_password=admin', '--admin_email=prueba@ejemplo.bo', '--skip-email');
  console.log('WordPress instalado');
}
if (siFalla(() => wp('plugin', 'is-active', 'woocommerce'), 'no') === 'no') {
  wp('plugin', 'install', 'woocommerce', '--activate');
  console.log('WooCommerce instalado');
}
wp('option', 'update', 'woocommerce_currency', 'BOB');
wp('option', 'update', 'woocommerce_coming_soon', 'no');
wp('rewrite', 'structure', '/%postname%/', '--hard');
wp('plugin', 'activate', 'abasto-woocommerce');
console.log(`Listo: ${url}/wp-admin (admin / admin) · WooCommerce › Abasto`);
