/**
 * Los sonidos de los momentos importantes (02/11, pedido de Andrés): «¡cha-ching!» al pagar y una fanfarria cuando
 * llega la compra. Son nuestros (sintetizados con `scripts`, sin licencias de terceros) y pesan poco.
 *
 * expo-audio es nativo: si la app de desarrollo instalada todavía no lo trae (falta `npx expo run:android`), se sigue
 * sin sonido en vez de romperse. En la web tampoco suena.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type Reproductor = { play: () => void; seekTo: (s: number) => Promise<void> | void; volume: number };
type ModuloDeAudio = {
  createAudioPlayer: (fuente: number) => Reproductor;
  setAudioModeAsync?: (modo: { playsInSilentMode?: boolean }) => Promise<void>;
};

const FUENTES = {
  pago: require('../assets/sonidos/pago.wav'),
  entrega: require('../assets/sonidos/entrega.wav'),
} as const;

export type Sonido = keyof typeof FUENTES;

let audio: ModuloDeAudio | null | undefined;
const listos = new Map<Sonido, Reproductor>();

function modulo(): ModuloDeAudio | null {
  if (audio !== undefined) return audio;
  if (Platform.OS === 'web') return (audio = null);
  // Primero se pregunta si está: cargar expo-audio sin su parte nativa avisa con un error en pantalla
  if (!requireOptionalNativeModule('ExpoAudio')) return (audio = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio = require('expo-audio') as ModuloDeAudio;
    // En el iPhone suena aunque el interruptor de silencio esté puesto: es la confirmación de un pago
    void audio.setAudioModeAsync?.({ playsInSilentMode: true }).catch(() => undefined);
  } catch {
    audio = null;
  }
  return audio;
}

/** Suena una vez (si se repite, vuelve al principio). Nunca lanza: un sonido no puede romper un pago. */
export function sonar(cual: Sonido) {
  try {
    const m = modulo();
    if (!m) return;
    let r = listos.get(cual);
    if (!r) {
      r = m.createAudioPlayer(FUENTES[cual]);
      r.volume = 1;
      listos.set(cual, r);
    }
    void Promise.resolve(r.seekTo(0)).catch(() => undefined);
    r.play();
  } catch {
    // Sin audio: el festejo sigue igual, con vibración
  }
}
