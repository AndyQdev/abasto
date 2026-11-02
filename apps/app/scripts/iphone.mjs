/**
 * Abre la app en un iPhone (o cualquier teléfono) con Expo Go, por wifi y sin cable: `npm run iphone`.
 * Busca la IP de la computadora en la red (el wifi, no la de WSL ni la de Docker) y arranca Metro en modo Expo Go.
 * En el teléfono: mismo wifi, Expo Go → «Enter URL manually» → la dirección que se muestra abajo.
 * La app usa esa misma IP para los servicios (src/config.ts), así que cambiar de wifi no rompe nada: se vuelve a correr.
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const PUERTO = 8090;
const candidatas = Object.entries(networkInterfaces())
  .flatMap(([nombre, ips]) => (ips ?? []).filter((i) => i.family === 'IPv4' && !i.internal).map((i) => ({ nombre, ip: i.address })))
  .filter(({ nombre, ip }) => !/vEthernet|WSL|docker|VirtualBox|VMware|Tailscale/i.test(nombre) && !ip.startsWith('172.'));
const elegida = candidatas.find((c) => /wi-?fi|wlan/i.test(c.nombre)) ?? candidatas.find((c) => c.ip.startsWith('192.168.')) ?? candidatas[0];
if (!elegida) {
  console.error('No encontré la IP de la computadora en el wifi. ¿Está conectada?');
  process.exit(1);
}
console.log(`\n  IP de la computadora: ${elegida.ip} (${elegida.nombre})`);
console.log(`  En el iPhone, Expo Go → Enter URL manually → exp://${elegida.ip}:${PUERTO}\n`);

const metro = spawn('npx', ['expo', 'start', '--go', '--lan', '--port', String(PUERTO)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: elegida.ip },
});
metro.on('exit', (codigo) => process.exit(codigo ?? 0));
