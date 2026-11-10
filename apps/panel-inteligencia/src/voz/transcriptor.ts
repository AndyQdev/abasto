/**
 * IA local en el navegador: Whisper transcribe la pregunta dentro del equipo; el audio no sale a ningún servidor.
 * El modelo (~80 MB) se baja la primera vez y queda en la caché del navegador, así después funciona sin internet.
 * La librería se baja del CDN recién cuando alguien usa el micrófono. No va dentro del build: el microfrontend se
 * compila en modo librería y Vite incrustaría los .wasm de onnxruntime como texto (un archivo de 72 MB).
 */
export interface Transcriptor {
  transcribir(audio: Float32Array): Promise<string>;
  /** Empieza a bajar o cargar el modelo mientras la persona habla, para transcribir en vivo cuanto antes. */
  preparar?(): Promise<void>;
  /** Carga el modelo antes de que lo pidan, solo si ya está en el equipo (nunca baja 80 MB por su cuenta). */
  precargar?(): Promise<void>;
}

/** Whisper espera audio mono a 16 kHz. */
export const FRECUENCIA_WHISPER = 16_000;
const MODELO = 'onnx-community/whisper-base';
const LIBRERIA = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';

type Reconocedor = (audio: Float32Array, opciones: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;
interface Transformers {
  pipeline(tarea: 'automatic-speech-recognition', modelo: string, opciones: { dtype: string }): Promise<Reconocedor>;
}

let reconocedor: Promise<Reconocedor> | null = null;

/**
 * Carga el modelo una sola vez por página, aunque lo pidan dos veces seguidas. La primera transcripción después de
 * cargar es mucho más lenta (el motor reserva memoria y compila): se hace una de calentamiento con un segundo de
 * silencio, así la primera pregunta de verdad sale tan rápido como las demás.
 */
function cargarReconocedor(): Promise<Reconocedor> {
  reconocedor ??= (import(/* @vite-ignore */ LIBRERIA) as Promise<Transformers>)
    .then(({ pipeline }) => pipeline('automatic-speech-recognition', MODELO, { dtype: 'q8' }))
    .then(async (reconocer) => {
      await reconocer(new Float32Array(FRECUENCIA_WHISPER), { language: 'spanish', task: 'transcribe' });
      return reconocer;
    })
    .catch((e: unknown) => {
      reconocedor = null; // sin internet la primera vez: que el siguiente intento vuelva a probar
      throw e;
    });
  return reconocedor;
}

/** ¿El modelo ya se bajó en este equipo? transformers.js lo guarda en la caché «transformers-cache». */
async function modeloEnElEquipo(): Promise<boolean> {
  try {
    if (!('caches' in globalThis) || !(await caches.has('transformers-cache'))) return false;
    const guardados = await (await caches.open('transformers-cache')).keys();
    return guardados.some((r) => r.url.includes(MODELO) && r.url.endsWith('.onnx'));
  } catch {
    return false;
  }
}

export const transcriptorWhisper: Transcriptor = {
  async preparar() {
    await cargarReconocedor();
  },
  async precargar() {
    if (await modeloEnElEquipo()) await cargarReconocedor();
  },
  async transcribir(audio) {
    const reconocer = await cargarReconocedor();
    // Una pregunta cabe de sobra en 64 tokens; el tope corta los bucles en que Whisper repite una palabra sin fin
    const salida = await reconocer(audio, { language: 'spanish', task: 'transcribe', max_new_tokens: 64 });
    return limpiarTranscripcion((Array.isArray(salida) ? salida[0] : salida).text);
  },
};

/**
 * Con silencio o ruido, Whisper en español «escucha» frases que nadie dijo: las de los subtítulos con que se
 * entrenó. Si eso es todo lo que entendió, no se pregunta nada.
 */
const FRASES_INVENTADAS = /^(¡?gracias( por ver( el video)?)?|subt[ií]tulos? (realizados )?por la comunidad de amara\.org|¡?suscr[ií]bete.*|m[uú]sica)[.!¡]*$/i;

/** Whisper a veces agrega espacios, puntos suspensivos o marcas como [Música] cuando no entiende. */
export function limpiarTranscripcion(texto: string): string {
  const limpio = texto
    .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.…]+|[\s.…]+$/g, '')
    .trim();
  return FRASES_INVENTADAS.test(limpio) ? '' : limpio;
}
