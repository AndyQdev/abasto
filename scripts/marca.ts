/**
 * Genera todos los íconos y logos de Abasto desde `packages/ui/marca.ts` (la fuente única de la marca).
 * Correr: `pnpm marca` (necesita el Chromium de Playwright de `e2e/`, que ya está si corriste los e2e).
 *
 * Deja:
 * - App (`apps/app/assets`): ícono, adaptativo de Android (frente, fondo y monocromo), notificación, pantalla de
 *   inicio y favicon. Hay que recompilar la app para verlos (`npx expo prebuild` y `npx expo run:android`).
 * - Webs: favicons del Panel (y sus remotos) y del Superadmin, e íconos de la PWA del Panel.
 * - `docs/marca`: los SVG del símbolo y el logo completo en PNG, para documentos y presentaciones.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLOR, PALABRA, TINTAS, iconoSvg, simboloSvg } from '../packages/ui/marca.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(join(raiz, 'e2e/package.json'))('@playwright/test');
// La fuente va adentro de la página: una página de setContent no puede leer archivos del disco
const FUENTE =
  'data:font/ttf;base64,' +
  readFileSync(join(raiz, 'apps/app/node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf')).toString('base64');

const ruta = (r: string) => join(raiz, r);
function escribir(r: string, contenido: string | Buffer) {
  mkdirSync(dirname(ruta(r)), { recursive: true });
  writeFileSync(ruta(r), contenido);
  console.log('  ' + r);
}

// Símbolo sobre un fondo que llena todo (iOS y Android le ponen su propia forma)
const aSangre = (escala: number) => simboloSvg({ escala, fondo: { color: COLOR.bosque, radio: 0 } });

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ deviceScaleFactor: 1 });

/** Pinta un SVG (o HTML) en un PNG de ancho × alto, con fondo transparente */
async function png(r: string, contenido: string, ancho: number, alto = ancho) {
  await pagina.setViewportSize({ width: ancho, height: alto });
  await pagina.setContent(
    `<!doctype html><html><head><style>
      @font-face { font-family: 'Jakarta'; font-weight: 800; src: url('${FUENTE}'); }
      html, body { margin: 0; background: transparent; }
      body > svg { display: block; width: ${ancho}px; height: ${alto}px; }
    </style></head><body>${contenido}</body></html>`,
  );
  await pagina.evaluate(() => document.fonts.ready);
  escribir(r, await pagina.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: ancho, height: alto } }));
}

/** Un .ico con un PNG adentro (lo entienden todos los navegadores) */
function ico(pngDe48: Buffer): Buffer {
  const cabecera = Buffer.alloc(22);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // tipo: ícono
  cabecera.writeUInt16LE(1, 4); // una imagen
  cabecera.writeUInt8(48, 6);
  cabecera.writeUInt8(48, 7);
  cabecera.writeUInt8(0, 8); // sin paleta
  cabecera.writeUInt8(0, 9);
  cabecera.writeUInt16LE(1, 10); // planos
  cabecera.writeUInt16LE(32, 12); // bits por pixel
  cabecera.writeUInt32LE(pngDe48.length, 14);
  cabecera.writeUInt32LE(22, 18); // donde empieza la imagen
  return Buffer.concat([cabecera, pngDe48]);
}

/** El logo completo: símbolo + «abasto». `tinta` del símbolo y color de la palabra según el fondo. */
function logo(alto: number, colorPalabra: string, tinta = TINTAS.sobreClaro) {
  return `<div style="display:inline-flex;align-items:center;gap:${alto * 0.14}px;padding:${alto * 0.08}px ${alto * 0.12}px;font-family:Jakarta">
    ${simboloSvg({ tinta, tamano: alto, id: 'l' + alto })}
    <span style="font-weight:${PALABRA.peso};font-size:${alto * 0.8}px;letter-spacing:${PALABRA.espaciado};color:${colorPalabra};line-height:1;margin-top:${alto * 0.02}px">${PALABRA.texto}</span>
  </div>`;
}

async function logoPng(r: string, alto: number, colorPalabra: string, tinta?: typeof TINTAS.sobreClaro) {
  await pagina.setViewportSize({ width: 4000, height: alto * 2 });
  await pagina.setContent(
    `<!doctype html><html><head><style>@font-face { font-family: 'Jakarta'; font-weight: 800; src: url('${FUENTE}'); }
      html, body { margin: 0; background: transparent; } body { display: inline-block; }</style></head>
      <body>${logo(alto, colorPalabra, tinta)}</body></html>`,
  );
  await pagina.evaluate(() => document.fonts.ready);
  escribir(r, await pagina.locator('body > div').screenshot({ omitBackground: true }));
}

console.log('App:');
await png('apps/app/assets/icon.png', aSangre(0.62), 1024);
await png('apps/app/assets/android-icon-foreground.png', simboloSvg({ escala: 0.5 }), 1024);
await png('apps/app/assets/android-icon-background.png', `<svg viewBox="0 0 1 1"><rect width="1" height="1" fill="${COLOR.bosque}"/></svg>`, 1024);
await png('apps/app/assets/android-icon-monochrome.png', simboloSvg({ escala: 0.5, tinta: TINTAS.blanco }), 1024);
// Notificación de Android: blanco sobre transparente (Android le pone el color), 24 dp → 96 px en xxxhdpi
await png('apps/app/assets/notificacion.png', simboloSvg({ escala: 0.92, tinta: TINTAS.blanco }), 96);
// Pantalla de inicio: el símbolo solo; el plugin expo-splash-screen de app.json lo centra sobre verde bosque
await png('apps/app/assets/splash-icon.png', simboloSvg({ escala: 0.8 }), 1024);
await png('apps/app/assets/favicon.png', iconoSvg(), 48);

console.log('Webs:');
for (const app of ['panel-shell', 'superadmin', 'panel-gestion', 'panel-inteligencia']) {
  escribir(`apps/${app}/public/favicon.svg`, iconoSvg() + '\n');
}
await png('apps/panel-shell/public/apple-touch-icon.png', aSangre(0.62), 180);
await png('apps/panel-shell/public/icono-192.png', iconoSvg(), 192);
await png('apps/panel-shell/public/icono-512.png', iconoSvg(), 512);
// «maskable»: Android recorta en círculo; el símbolo va dentro del 80 % del centro
await png('apps/panel-shell/public/icono-mascara-512.png', aSangre(0.5), 512);

console.log('Documentos:');
escribir('docs/marca/simbolo-lima.svg', simboloSvg({ tinta: TINTAS.sobreOscuro }) + '\n');
escribir('docs/marca/simbolo-bosque.svg', simboloSvg({ tinta: TINTAS.sobreClaro }) + '\n');
escribir('docs/marca/simbolo-blanco.svg', simboloSvg({ tinta: TINTAS.blanco }) + '\n');
escribir('docs/marca/icono.svg', iconoSvg() + '\n');
await png('docs/marca/icono-1024.png', iconoSvg(), 1024);
await logoPng('docs/marca/abasto-logo.png', 240, COLOR.bosque);
await logoPng('docs/marca/abasto-logo-blanco.png', 240, COLOR.blanco, TINTAS.sobreOscuro);

// favicon.ico para quien lo pida sin mirar el <link> (navegadores viejos, lectores de RSS)
await pagina.setViewportSize({ width: 48, height: 48 });
await pagina.setContent(`<html><body style="margin:0;background:transparent">${iconoSvg({ tamano: 48 })}</body></html>`);
escribir('apps/panel-shell/public/favicon.ico', ico(await pagina.screenshot({ omitBackground: true })));

await navegador.close();
console.log('Listo. Para la app: npx expo prebuild --platform android y recompilar.');
