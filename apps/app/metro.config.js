const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * La app vive fuera del workspace de pnpm (npm propio), pero usa la lógica compartida del monorepo:
 * @abasto/comercio (catálogo, carrito y saga) y la bandeja offline de @abasto/outbox-offline.
 */
const raiz = path.resolve(__dirname, '../..');
const COMPARTIDO = {
  '@abasto/comercio': path.join(raiz, 'packages/comercio/src/index.ts'),
  '@abasto/bandeja': path.join(raiz, 'packages/outbox-offline/src/bandeja.ts'),
  // La marca (10/11): la misma geometría del logo que usan las webs y los íconos
  '@abasto/marca': path.join(raiz, 'packages/ui/marca.ts'),
  // three en su versión de módulos (la que usa todo el mundo): la de CommonJS llama a `process.emitWarning`, que en
  // React Native no existe, y la escena 3D se caía al cargar (02/11). Además así hay una sola copia de three.
  three: path.join(__dirname, 'node_modules/three/build/three.module.js'),
};

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.join(raiz, 'packages/comercio'), path.join(raiz, 'packages/outbox-offline'), path.join(raiz, 'packages/ui')];
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')];

const resolverPorDefecto = config.resolver.resolveRequest;
config.resolver.resolveRequest = (contexto, nombre, plataforma) => {
  if (COMPARTIDO[nombre]) return { type: 'sourceFile', filePath: COMPARTIDO[nombre] };
  return (resolverPorDefecto ?? contexto.resolveRequest)(contexto, nombre, plataforma);
};

if (!config.resolver.assetExts.includes('tflite')) {
  config.resolver.assetExts.push('tflite');
}

module.exports = config;
