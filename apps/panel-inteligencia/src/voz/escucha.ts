import { FRECUENCIA_WHISPER } from './transcriptor';

/**
 * Escucha del micrófono para preguntar hablando, como en un chat de voz:
 * - junta el audio mientras la persona habla, para que Whisper lo vaya transcribiendo en vivo;
 * - mide el volumen, para que la burbuja muestre que está escuchando;
 * - se da cuenta sola de que la persona terminó (un silencio corto después de hablar) y avisa.
 *
 * Todo pasa dentro del navegador: el audio no sale del equipo.
 */
export interface Escucha {
  /** Lo grabado hasta ahora, mono a 16 kHz, cortado poco después de la última palabra. */
  audio(): Float32Array;
  /** ¿Ya dijo algo? Ruido suelto (una tos, un golpe) no cuenta. */
  readonly hablo: boolean;
  /** Segundos desde el inicio hasta el final de la última palabra (0 si todavía no habló). */
  readonly finDeLaVoz: number;
  /** Segundos escuchados hasta ahora (con el silencio del final). */
  readonly duracion: number;
  /** Deja de escuchar, suelta el micrófono y devuelve lo grabado. */
  detener(): Float32Array;
}

export interface EventosDeEscucha {
  /** Volumen de 0 a 1, varias veces por segundo. */
  nivel(n: number): void;
  /** La persona terminó de hablar (o no dijo nada, o se pasó del tiempo máximo). */
  callo(): void;
}

export type IniciarEscucha = (eventos: EventosDeEscucha) => Promise<Escucha>;

export interface TiemposDeEscucha {
  /** Silencio después de hablar que cierra la pregunta. */
  silencioParaTerminar: number;
  /** Si no dice nada en este tiempo, se deja de escuchar. */
  esperaSinVoz: number;
  /** Tope de una pregunta. */
  maximo: number;
  /** Voz acumulada para dar por hecho que habló (no un ruido suelto). */
  vozMinima: number;
}

export const TIEMPOS: TiemposDeEscucha = { silencioParaTerminar: 1100, esperaSinVoz: 8000, maximo: 30_000, vozMinima: 250 };

/** Lo que se deja después de la última palabra: Whisper corta mal si la frase termina justo en el borde. */
const COLA_DESPUES_DE_HABLAR = 0.35;

/**
 * Decide, trozo por trozo, si hay voz y si la persona ya terminó. Se adapta al ruido de fondo de cada lugar:
 * en una oficina callada y en un depósito con ruido, «hablar» es estar claramente por encima del fondo.
 */
export class DetectorDeVoz {
  private piso = 0.008;
  private transcurrido = 0;
  private conVoz = 0;
  private ultimaVoz = 0;
  hablo = false;
  private readonly tiempos: TiemposDeEscucha;

  constructor(tiempos: TiemposDeEscucha = TIEMPOS) {
    this.tiempos = tiempos;
  }

  /** Un trozo de audio: su volumen (RMS) y cuánto dura, en milisegundos. */
  procesar(rms: number, ms: number): { voz: boolean; terminar: boolean } {
    this.transcurrido += ms;
    const voz = rms > Math.max(0.015, this.piso * 3);
    if (voz) {
      this.conVoz += ms;
      this.ultimaVoz = this.transcurrido;
      if (this.conVoz >= this.tiempos.vozMinima) this.hablo = true;
    } else {
      // El fondo se aprende solo con lo que no es voz
      this.piso = this.piso * 0.92 + rms * 0.08;
    }
    const terminar =
      (this.hablo && this.transcurrido - this.ultimaVoz >= this.tiempos.silencioParaTerminar) ||
      (!this.hablo && this.transcurrido >= this.tiempos.esperaSinVoz) ||
      this.transcurrido >= this.tiempos.maximo;
    return { voz, terminar };
  }

  /** Milisegundos hasta el final de la última palabra. */
  get finDeLaVoz(): number {
    return this.hablo ? this.ultimaVoz : 0;
  }
}

export function volumen(muestras: Float32Array): number {
  let suma = 0;
  for (const m of muestras) suma += m * m;
  return Math.sqrt(suma / Math.max(1, muestras.length));
}

/**
 * Pasa el audio del micrófono (44,1 o 48 kHz) a los 16 kHz que pide Whisper. Promedia cada ventana en lugar de
 * saltear muestras: así no se cuelan los agudos como ruido (un filtro simple, alcanza para voz).
 */
export function aDieciseisKHz(muestras: Float32Array, frecuencia: number): Float32Array {
  if (frecuencia === FRECUENCIA_WHISPER) return muestras;
  const razon = frecuencia / FRECUENCIA_WHISPER;
  const salida = new Float32Array(Math.floor(muestras.length / razon));
  for (let i = 0; i < salida.length; i++) {
    const desde = Math.floor(i * razon);
    const hasta = Math.min(muestras.length, Math.max(desde + 1, Math.floor((i + 1) * razon)));
    let suma = 0;
    for (let k = desde; k < hasta; k++) suma += muestras[k];
    salida[i] = suma / (hasta - desde);
  }
  return salida;
}

// Corre en el hilo de audio: junta trozos de 2.048 muestras y los manda a la página
const CAPTURA = `
class CapturaAbasto extends AudioWorkletProcessor {
  constructor() { super(); this.trozo = new Float32Array(2048); this.i = 0; }
  process(entradas) {
    const x = entradas[0] && entradas[0][0];
    if (!x) return true;
    for (let k = 0; k < x.length; k++) {
      this.trozo[this.i++] = x[k];
      if (this.i === this.trozo.length) { this.port.postMessage(this.trozo.slice(0)); this.i = 0; }
    }
    return true;
  }
}
registerProcessor('captura-abasto', CapturaAbasto);
`;

/** La escucha de verdad: micrófono, AudioWorklet y detector de voz. */
export const escucharDelMicrofono: IniciarEscucha = async (eventos) => {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
    throw new Error('Este navegador no permite usar el micrófono');
  }
  let flujo: MediaStream;
  try {
    flujo = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    throw new Error('No tengo permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.');
  }

  const contexto = new AudioContext();
  const soltar = () => {
    for (const pista of flujo.getTracks()) pista.stop();
    void contexto.close().catch(() => undefined);
  };

  try {
    const url = URL.createObjectURL(new Blob([CAPTURA], { type: 'text/javascript' }));
    try {
      await contexto.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const captura = new AudioWorkletNode(contexto, 'captura-abasto', { channelCount: 1 });
    const mudo = contexto.createGain();
    mudo.gain.value = 0;
    contexto.createMediaStreamSource(flujo).connect(captura);
    captura.connect(mudo).connect(contexto.destination);

    const frecuencia = contexto.sampleRate;
    const trozos: Float32Array[] = [];
    let total = 0;
    const detector = new DetectorDeVoz();
    let terminado = false;

    captura.port.onmessage = ({ data }: MessageEvent<Float32Array>) => {
      if (terminado) return;
      trozos.push(data);
      total += data.length;
      const rms = volumen(data);
      eventos.nivel(Math.min(1, rms * 8));
      if (detector.procesar(rms, (data.length / frecuencia) * 1000).terminar) {
        terminado = true;
        eventos.callo();
      }
    };

    const juntar = () => {
      const fin = detector.hablo ? Math.min(total, Math.ceil((detector.finDeLaVoz / 1000 + COLA_DESPUES_DE_HABLAR) * frecuencia)) : total;
      const todo = new Float32Array(fin);
      let i = 0;
      for (const t of trozos) {
        if (i >= fin) break;
        todo.set(t.subarray(0, fin - i), i);
        i += t.length;
      }
      return aDieciseisKHz(todo, frecuencia);
    };

    return {
      audio: juntar,
      get hablo() {
        return detector.hablo;
      },
      get finDeLaVoz() {
        return detector.finDeLaVoz / 1000;
      },
      get duracion() {
        return total / frecuencia;
      },
      detener() {
        terminado = true;
        captura.port.onmessage = null;
        soltar();
        return juntar();
      },
    };
  } catch (e) {
    soltar();
    throw e;
  }
};
