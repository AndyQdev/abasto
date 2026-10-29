/**
 * IA local en el navegador: Whisper transcribe la pregunta dentro del equipo; el audio no sale a ningún servidor.
 * El modelo (~80 MB) se baja la primera vez y queda en la caché del navegador, así después funciona sin internet.
 * La librería se baja del CDN recién cuando alguien usa el micrófono. No va dentro del build: el microfrontend se
 * compila en modo librería y Vite incrustaría los .wasm de onnxruntime como texto (un archivo de 72 MB).
 */
export interface Transcriptor {
  transcribir(audio: Float32Array): Promise<string>;
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

/** Carga el modelo una sola vez por página, aunque lo pidan dos veces seguidas. */
function cargarReconocedor(): Promise<Reconocedor> {
  reconocedor ??= (import(/* @vite-ignore */ LIBRERIA) as Promise<Transformers>)
    .then(({ pipeline }) => pipeline('automatic-speech-recognition', MODELO, { dtype: 'q8' }))
    .catch((e: unknown) => {
      reconocedor = null; // sin internet la primera vez: que el siguiente intento vuelva a probar
      throw e;
    });
  return reconocedor;
}

export const transcriptorWhisper: Transcriptor = {
  async transcribir(audio) {
    const reconocer = await cargarReconocedor();
    const salida = await reconocer(audio, { language: 'spanish', task: 'transcribe' });
    return limpiarTranscripcion((Array.isArray(salida) ? salida[0] : salida).text);
  },
};

/** Whisper a veces agrega espacios, puntos suspensivos o marcas como [Música] cuando no entiende. */
export function limpiarTranscripcion(texto: string): string {
  return texto
    .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.…]+|[\s.…]+$/g, '')
    .trim();
}

/** Pasa la grabación (webm/ogg del navegador) a muestras mono de 16 kHz, como las pide Whisper. */
export async function audioParaWhisper(grabacion: Blob): Promise<Float32Array> {
  const contexto = new AudioContext();
  try {
    const original = await contexto.decodeAudioData(await grabacion.arrayBuffer());
    const muestras = Math.ceil(original.duration * FRECUENCIA_WHISPER);
    const conversor = new OfflineAudioContext(1, muestras, FRECUENCIA_WHISPER);
    const fuente = conversor.createBufferSource();
    fuente.buffer = original;
    fuente.connect(conversor.destination);
    fuente.start();
    return (await conversor.startRendering()).getChannelData(0);
  } finally {
    await contexto.close();
  }
}
