// `pnpm verificar`: revisa que la máquina tenga lo necesario antes de `pnpm todo`.
// No instala nada: solo dice qué falta y cómo conseguirlo.
import { execSync } from 'node:child_process';
import net from 'node:net';

const ok = (m) => console.log(`  ✓ ${m}`);
const mal = (m) => {
  console.log(`  ✗ ${m}`);
  process.exitCode = 1;
};
const aviso = (m) => console.log(`  ! ${m}`);

function salida(comando) {
  try {
    return execSync(comando, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  } catch (e) {
    // java -version escribe en stderr
    return e.stderr?.toString().trim() || null;
  }
}

function versionMayor(texto) {
  const m = /(\d+)\.(\d+)/.exec(texto ?? '');
  return m ? [Number(m[1]), Number(m[2])] : null;
}

console.log('Herramientas');
const [nodeMayor, nodeMenor] = process.versions.node.split('.').map(Number);
nodeMayor >= 22 ? ok(`Node ${process.versions.node}`) : mal(`Node ${process.versions.node}: hace falta 22 o más`);
if (nodeMayor === 22 && nodeMenor < 22) aviso('Con Node 22.22+ se podría subir a Angular 22; con esta versión se queda en Angular 21');

const pnpm = salida('pnpm --version');
pnpm ? ok(`pnpm ${pnpm}`) : mal('pnpm: corepack enable && corepack prepare pnpm@12.3.4 --activate');

const docker = salida('docker info --format "{{.ServerVersion}}"');
docker && !docker.includes('error') ? ok(`Docker ${docker}`) : mal('Docker no responde: abre Docker Desktop');

const java = versionMayor(salida('java -version 2>&1'));
java && java[0] >= 17
  ? ok(`Java ${java[0]} (Gradle baja el JDK 21 solo)`)
  : aviso('Java 17+ no está: hace falta solo para correr Pedidos fuera de Docker (pnpm dev:pedidos)');

const uv = salida('uv --version');
uv ? ok(uv) : aviso('uv no está: hace falta solo para ml/ (https://docs.astral.sh/uv/)');

const git = salida('git --version');
git ? ok(git) : mal('git no está');

console.log('\nPuertos (ocupado = ya está corriendo algo; si no es Abasto, cámbialo en .env)');
const puertos = {
  5440: 'Postgres', 27020: 'MongoDB', 8800: 'DynamoDB Local', 5680: 'RabbitMQ', 8180: 'Keycloak',
  4000: 'Router', 16686: 'Jaeger', 8081: 'Pedidos', 8082: 'Catálogo', 8083: 'Cobros', 8084: 'Conecta',
  8085: 'Asistente', 5170: 'Panel Shell', 5171: 'Gestión', 5172: 'Inteligencia', 5173: 'Mercado', 5174: 'Superadmin',
};

function ocupado(puerto) {
  return new Promise((resolver) => {
    const s = net.connect({ port: puerto, host: 'localhost' });
    s.setTimeout(400);
    s.once('connect', () => (s.destroy(), resolver(true)));
    s.once('timeout', () => (s.destroy(), resolver(false)));
    s.once('error', () => resolver(false));
  });
}

for (const [puerto, nombre] of Object.entries(puertos)) {
  console.log(`  ${(await ocupado(Number(puerto))) ? '●' : '○'} ${puerto} ${nombre}`);
}

console.log(process.exitCode ? '\nFalta algo de arriba (✗).' : '\nTodo listo: pnpm install && pnpm todo');
