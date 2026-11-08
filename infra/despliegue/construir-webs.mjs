// node infra/despliegue/construir-webs.mjs [shell|gestion|inteligencia|superadmin ...]
// Construye las webs con las direcciones públicas y las deja en infra/despliegue/gcp/webs/<web>, listas para subir a Google Cloud.
// Sin argumentos construye las cuatro; con uno o más, solo esas (cada microfrontend se sube por separado).
// Lee DOMINIO (Google), DOMINIO_AWS y DOMINIO_AZURE de infra/despliegue/gcp/.env (o del entorno).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..');
const destino = join(aqui, 'gcp', 'webs');

const archivoEnv = join(aqui, 'gcp', '.env');
const delArchivo = existsSync(archivoEnv)
  ? Object.fromEntries(
      readFileSync(archivoEnv, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2]]),
    )
  : {};
const leer = (clave) => {
  const valor = process.env[clave] ?? delArchivo[clave];
  if (!valor) throw new Error(`Falta ${clave} (en infra/despliegue/gcp/.env o en el entorno)`);
  return valor;
};

const gcp = leer('DOMINIO');
const aws = leer('DOMINIO_AWS');
const azure = leer('DOMINIO_AZURE');
const url = (sub, dominio) => `https://${sub}.${dominio}`;

const VITE = {
  VITE_KEYCLOAK_URL: `${url('auth', gcp)}/realms/abasto`,
  VITE_PANEL_URL: `${url('panel', gcp)}/`,
  VITE_SUPERADMIN_URL: `${url('superadmin', gcp)}/`,
  VITE_ROUTER_URL: `${url('api', gcp)}/`,
  VITE_CONECTA_URL: url('conecta', aws),
  VITE_ASISTENTE_URL: url('asistente', azure),
  VITE_SALUD_PEDIDOS: url('pedidos', azure),
  VITE_SALUD_COBROS: url('cobros', azure),
  VITE_SALUD_ASISTENTE: url('asistente', azure),
  VITE_SALUD_CONECTA: url('conecta', aws),
  VITE_SALUD_CATALOGO: url('catalogo', gcp),
};

const WEBS = {
  shell: { paquete: '@abasto/panel-shell', comando: ['vite', 'build'], salida: 'apps/panel-shell/dist' },
  gestion: {
    paquete: '@abasto/panel-gestion',
    comando: ['ng', 'build', '--configuration', 'production'],
    salida: 'apps/panel-gestion/dist/panel-gestion/browser',
  },
  inteligencia: { paquete: '@abasto/panel-inteligencia', comando: ['vite', 'build'], salida: 'apps/panel-inteligencia/dist' },
  superadmin: { paquete: '@abasto/superadmin', comando: ['vite', 'build'], salida: 'apps/superadmin/dist' },
};

const pedidas = process.argv.slice(2);
for (const nombre of pedidas) if (!WEBS[nombre]) throw new Error(`No conozco la web «${nombre}». Son: ${Object.keys(WEBS).join(', ')}`);

for (const nombre of pedidas.length ? pedidas : Object.keys(WEBS)) {
  const web = WEBS[nombre];
  console.log(`\n▶ ${nombre}`);
  const r = spawnSync('pnpm', ['--filter', web.paquete, 'exec', ...web.comando], {
    cwd: raiz,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...VITE },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  const carpeta = join(destino, nombre);
  rmSync(carpeta, { recursive: true, force: true });
  mkdirSync(carpeta, { recursive: true });
  cpSync(join(raiz, web.salida), carpeta, { recursive: true });

  // El Shell busca los remotos en sus subdominios: se cambia un remoto sin reconstruir el Shell
  if (nombre === 'shell') {
    const remotos = {
      gestion: { elemento: 'abasto-gestion', scripts: [`${url('gestion', gcp)}/main.js`] },
      inteligencia: { elemento: 'abasto-inteligencia', scripts: [`${url('inteligencia', gcp)}/remoteEntry.js`] },
    };
    writeFileSync(join(carpeta, 'remotos.json'), `${JSON.stringify(remotos, null, 2)}\n`);
  }
  console.log(`✔ ${nombre} → infra/despliegue/gcp/webs/${nombre}`);
}
