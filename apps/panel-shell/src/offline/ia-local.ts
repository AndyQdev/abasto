/**
 * IA local del navegador dentro de la PWA (requisito: «el navegador tiene su IA local y funciona sin internet»).
 * Las reglas las usa el service worker (sw.ts) y se prueban sin él:
 * - La librería que corre el modelo se baja de un CDN con la versión exacta en la ruta: no cambia nunca,
 *   así que se guarda una vez (CacheFirst) y sin señal sale de ahí.
 * - Los modelos (Hugging Face) los guarda la propia librería en su caché (transformers-cache en el caso de
 *   Whisper). El service worker no los toca: si los guardara también, los cientos de MB quedarían dos veces.
 */
export const CACHE_IA_LOCAL = 'abasto-ia-local';

const HOSTS_DE_MODELOS = /(^|\.)(huggingface\.co|hf\.co)$/;
const CDNS = new Set(['cdn.jsdelivr.net', 'unpkg.com', 'esm.sh']);
// …/npm/@huggingface/transformers@4.3.1/… o …/npm/onnxruntime-web@1.31.0-dev…/…: versión exacta, no «@4» ni «@latest»
const VERSION_EXACTA = /@\d+\.\d+\.\d+[^/]*\//;

/** Un archivo de modelo: lo maneja la librería de IA, el service worker lo deja pasar. */
export function esArchivoDeModelo(url: URL): boolean {
  return HOSTS_DE_MODELOS.test(url.hostname);
}

/** Código de un CDN con versión fija (la librería de IA y su runtime .wasm): se guarda una vez y sirve sin señal. */
export function esLibreriaConVersion(url: URL): boolean {
  return CDNS.has(url.hostname) && VERSION_EXACTA.test(url.pathname);
}
