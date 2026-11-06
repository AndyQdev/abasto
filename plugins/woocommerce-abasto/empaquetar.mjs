// Arma el .zip que se sube en WordPress › Plugins › Añadir nuevo (`pnpm plugin:zip`). Queda en plugins/dist/.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const dist = resolve(aqui, '..', 'dist');
const carpeta = resolve(dist, 'abasto-woocommerce');

rmSync(dist, { recursive: true, force: true });
mkdirSync(carpeta, { recursive: true });
// Solo lo que corre en la tienda: sin pruebas ni herramientas
cpSync(resolve(aqui, 'abasto-woocommerce.php'), resolve(carpeta, 'abasto-woocommerce.php'));
cpSync(resolve(aqui, 'includes'), resolve(carpeta, 'includes'), { recursive: true });
cpSync(resolve(aqui, 'readme.txt'), resolve(carpeta, 'readme.txt'));

// tar crea .zip en Windows (bsdtar) y en macOS; en Linux se usa zip
const zip = 'abasto-woocommerce.zip';
if (process.platform === 'linux') execFileSync('zip', ['-rq', zip, 'abasto-woocommerce'], { cwd: dist, stdio: 'inherit' });
else execFileSync('tar', ['-a', '-cf', zip, 'abasto-woocommerce'], { cwd: dist, stdio: 'inherit' });
rmSync(carpeta, { recursive: true, force: true });
console.log(`Listo: ${resolve(dist, zip)}`);
