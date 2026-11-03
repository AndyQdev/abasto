// pnpm dev:panel:pwa · el Panel como PWA instalada: el Shell construido (con service worker) en 5170 y los remotos
// (Gestión 5171 e Inteligencia 5172) en desarrollo. Sirve para probar lo que pasa sin señal, también la IA local del
// navegador: con pnpm dev:panel no hay service worker. Ctrl+C para todo.
import { spawn, spawnSync } from 'node:child_process';

const correr = (args) => spawn('pnpm', args, { stdio: 'inherit', shell: true });

const build = spawnSync('pnpm', ['--filter', '@abasto/panel-shell', 'exec', 'vite', 'build'], { stdio: 'inherit', shell: true });
if (build.status !== 0) process.exit(build.status ?? 1);

const procesos = [
  correr(['--parallel', '--filter', '@abasto/panel-gestion', '--filter', '@abasto/panel-inteligencia', 'dev']),
  correr(['--filter', '@abasto/panel-shell', 'exec', 'vite', 'preview']),
];
console.log('\nPanel PWA en http://localhost:5170 · para volver a pnpm dev:panel no hace falta borrar nada (el service worker se va solo)\n');

const parar = () => {
  for (const p of procesos) p.kill();
  process.exit(0);
};
process.on('SIGINT', parar);
process.on('SIGTERM', parar);
for (const p of procesos) p.on('exit', (codigo) => codigo && parar());
