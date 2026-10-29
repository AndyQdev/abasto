// Corre el Gradle Wrapper de Pedidos igual en Windows, macOS y Linux:
// `node scripts/gradle.mjs test` → services/pedidos/gradlew test
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const carpeta = fileURLToPath(new URL('../services/pedidos/', import.meta.url));
const windows = process.platform === 'win32';
// Ruta completa: algunas terminales de Windows no buscan ejecutables en la carpeta actual (NoDefaultCurrentDirectoryInExePath)
const { status } = spawnSync(join(carpeta, windows ? 'gradlew.bat' : 'gradlew'), process.argv.slice(2), {
  cwd: carpeta,
  stdio: 'inherit',
  shell: windows,
});
process.exit(status ?? 1);
