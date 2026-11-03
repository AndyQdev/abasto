import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * Requisito del ingeniero: el navegador tiene su IA local y funciona sin internet.
 * Con señal, la primera vez se baja la librería (CDN) y el modelo de Whisper (Hugging Face); después, sin señal,
 * el Panel instalado (PWA) vuelve a transcribir sin salir a la red.
 * Baja ~80 MB la primera vez: corre solo con IA_NAVEGADOR=1 y con el Shell construido (pnpm --filter @abasto/panel-shell pwa).
 */
const LIBRERIA = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';
const MODELO = 'onnx-community/whisper-base';

test.skip(!process.env.IA_NAVEGADOR, 'baja el modelo de Whisper (~80 MB): IA_NAVEGADOR=1 para correrla');
test.setTimeout(600_000);

async function transcribirSilencio(page: import('@playwright/test').Page) {
  return page.evaluate(
    async ({ libreria, modelo }) => {
      const { pipeline } = await import(/* @vite-ignore */ libreria);
      const reconocer = await pipeline('automatic-speech-recognition', modelo, { dtype: 'q8' });
      const salida = await reconocer(new Float32Array(16_000), { language: 'spanish', task: 'transcribe' });
      return typeof (Array.isArray(salida) ? salida[0] : salida).text;
    },
    { libreria: LIBRERIA, modelo: MODELO },
  );
}

test('la voz con Whisper sigue andando sin señal en el Panel instalado', async ({ page, context }) => {
  await page.goto('http://localhost:5170/reportes');
  await entrarComo(page, 'lospozos@abasto.bo');
  const conServiceWorker = await page.evaluate(async () => {
    const registro = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 5000))]);
    return registro !== null;
  });
  test.skip(!conServiceWorker, 'el Shell corre con pnpm dev:panel, sin service worker');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // Con señal: se baja todo una vez
  expect(await transcribirSilencio(page)).toBe('string');

  // Sin señal: la página se recarga y Whisper vuelve a cargar desde lo guardado
  await context.setOffline(true);
  await page.reload();
  expect(await transcribirSilencio(page)).toBe('string');
  await context.setOffline(false);

  // La librería queda en la caché de la IA local; el modelo, una sola vez (en la de la librería)
  const guardado = await page.evaluate(async () => {
    const urls = async (nombre: string) => ((await caches.has(nombre)) ? (await (await caches.open(nombre)).keys()).map((r) => r.url) : []);
    return { ia: await urls('abasto-ia-local'), remotos: await urls('abasto-remotos'), modelo: await urls('transformers-cache') };
  });
  expect(guardado.ia).toContain(LIBRERIA);
  expect(guardado.modelo.some((u) => u.endsWith('.onnx'))).toBe(true);
  expect(guardado.remotos.filter((u) => u.includes('huggingface.co'))).toEqual([]);
});
