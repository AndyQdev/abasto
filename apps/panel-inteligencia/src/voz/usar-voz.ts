import { computed, getCurrentScope, onScopeDispose, ref } from 'vue';
import { escucharDelMicrofono, type Escucha, type IniciarEscucha } from './escucha';
import { FRECUENCIA_WHISPER, transcriptorWhisper, type Transcriptor } from './transcriptor';

export type EstadoDeVoz = 'lista' | 'abriendo' | 'escuchando' | 'transcribiendo';

export interface DependenciasDeVoz {
  escuchar: IniciarEscucha;
  transcriptor: Transcriptor;
  /** Cada cuánto se vuelve a transcribir lo dicho mientras la persona habla. */
  cadaMs?: number;
}

const REALES: DependenciasDeVoz = { escuchar: escucharDelMicrofono, transcriptor: transcriptorWhisper };

/** Menos audio nuevo que esto no justifica volver a transcribir (Whisper corre en el equipo y cuesta). */
const AUDIO_NUEVO_MINIMO = 0.4;
/**
 * Si lo transcrito ya cubre hasta la última palabra y la persona lleva esta pausa, la pregunta sale sin esperar
 * el silencio completo del detector. Más corto cortaría a quien hace una pausa en medio de la frase.
 */
const PAUSA_PARA_ENVIAR = 0.8;
/** Una pausa así (en segundos) ya puede ser el final: vale la pena transcribir todo lo dicho. */
const PAUSA_PARA_TRANSCRIBIR = 0.3;
/**
 * Whisper corre en el procesador del equipo y su velocidad cambia mucho de una máquina a otra (en una laptop
 * cargada se midió de 3 a 11 s por frase). Si tarda más que esto, transcribir media frase mientras la persona sigue
 * hablando solo atrasa la respuesta final: se espera a la primera pausa.
 */
const RAPIDO_MS = 1200;

/**
 * Preguntar hablando, como en un chat de voz:
 * 1. Un toque al micrófono y empieza a escuchar.
 * 2. Mientras habla, Whisper (en el navegador) transcribe lo dicho cada poco y `parcial` lo muestra en la burbuja.
 * 3. Cuando se calla, la pregunta sale sola. También se puede tocar «Listo» para no esperar el silencio.
 *
 * Las dependencias se cambian en las pruebas: en jsdom no hay micrófono ni modelo.
 */
export function usarVoz(alTranscribir: (texto: string) => void, dependencias: DependenciasDeVoz = REALES) {
  const estado = ref<EstadoDeVoz>('lista');
  const parcial = ref('');
  const nivel = ref(0);
  const error = ref<string | null>(null);

  let escucha: Escucha | null = null;
  let reloj: ReturnType<typeof setInterval> | null = null;
  let enCurso: Promise<void> | null = null;
  /** Segundos de audio que cubre `parcial`: si cubre hasta la última palabra, no hace falta transcribir de nuevo. */
  let cubierto = 0;
  let modeloListo = !dependencias.transcriptor.preparar;
  /** Lo que tardó la última transcripción; sin medir, se asume un equipo lento. */
  let ultimaDuracion: number | null = null;

  const escuchando = computed(() => estado.value === 'abriendo' || estado.value === 'escuchando' || estado.value === 'transcribiendo');

  function pararReloj() {
    if (reloj) clearInterval(reloj);
    reloj = null;
  }

  async function empezar() {
    error.value = null;
    parcial.value = '';
    cubierto = 0;
    estado.value = 'abriendo';
    // El modelo se carga mientras la persona habla; la primera vez se baja (~80 MB)
    dependencias.transcriptor
      .preparar?.()
      .then(() => (modeloListo = true))
      .catch(() => undefined);
    try {
      escucha = await dependencias.escuchar({
        nivel: (n) => (nivel.value = n),
        callo: () => void terminar(),
      });
    } catch (e) {
      estado.value = 'lista';
      error.value = (e as Error).message;
      return;
    }
    if (estado.value !== 'abriendo') {
      // Se canceló mientras se abría el micrófono
      escucha.detener();
      escucha = null;
      return;
    }
    estado.value = 'escuchando';
    reloj = setInterval(transcribirLoDicho, dependencias.cadaMs ?? 300);
  }

  /**
   * Transcribe lo que va dicho, de a una vez: si Whisper todavía está con la anterior, espera al próximo tic.
   * Whisper procesa siempre una ventana de 30 s: media frase cuesta lo mismo que la frase entera, así que se
   * transcribe seguido y cada resultado reemplaza al anterior.
   */
  function transcribirLoDicho() {
    if (!escucha || estado.value !== 'escuchando' || !escucha.hablo || !modeloListo) return;
    if (parcial.value && cubierto >= escucha.finDeLaVoz && escucha.duracion - escucha.finDeLaVoz >= PAUSA_PARA_ENVIAR) {
      void terminar();
      return;
    }
    if (enCurso) return;
    const rapido = ultimaDuracion !== null && ultimaDuracion < RAPIDO_MS;
    if (!rapido && escucha.duracion - escucha.finDeLaVoz < PAUSA_PARA_TRANSCRIBIR) return;
    const audio = escucha.audio();
    const segundos = audio.length / FRECUENCIA_WHISPER;
    if (segundos - cubierto < AUDIO_NUEVO_MINIMO) return;
    const desde = Date.now();
    enCurso = dependencias.transcriptor
      .transcribir(audio)
      .then((texto) => {
        ultimaDuracion = Date.now() - desde;
        if (estado.value === 'escuchando' && texto) {
          parcial.value = texto;
          cubierto = segundos;
        }
      })
      .catch(() => undefined)
      .finally(() => (enCurso = null));
  }

  /** Terminó de hablar: transcribe lo que falte y entrega la pregunta. */
  async function terminar() {
    if (estado.value !== 'escuchando' || !escucha) return;
    const actual = escucha;
    escucha = null;
    pararReloj();
    estado.value = 'transcribiendo';
    nivel.value = 0;
    const audio = actual.detener();
    try {
      if (!actual.hablo) {
        error.value = 'No te escuché. Toca el micrófono y habla con normalidad.';
        return;
      }
      if (enCurso) await enCurso;
      const alDia = parcial.value && cubierto >= actual.finDeLaVoz;
      const texto = alDia ? parcial.value : await dependencias.transcriptor.transcribir(audio);
      if (texto.length < 3) error.value = 'No te entendí. Habla un poco más cerca del micrófono y vuelve a intentar.';
      else alTranscribir(texto);
    } catch {
      error.value = 'No se pudo transcribir. La primera vez se necesita internet para bajar el modelo de voz.';
    } finally {
      estado.value = 'lista';
      parcial.value = '';
    }
  }

  /** Corta sin preguntar nada y suelta el micrófono. */
  function cancelar() {
    pararReloj();
    escucha?.detener();
    escucha = null;
    estado.value = 'lista';
    parcial.value = '';
    nivel.value = 0;
  }

  /** El botón del micrófono: si está libre empieza; si está escuchando, «Listo». */
  async function alternar() {
    if (estado.value === 'lista') return empezar();
    if (estado.value === 'escuchando') return terminar();
  }

  // Si el modelo ya está en el equipo, se carga en un momento libre: la primera pregunta por voz no espera la carga
  let precarga: ReturnType<typeof setTimeout> | null = null;
  if (dependencias.transcriptor.precargar) {
    precarga = setTimeout(() => {
      // Al tocar el micrófono, `preparar` encuentra el modelo ya cargado y responde al instante
      dependencias.transcriptor.precargar?.().catch(() => undefined);
    }, 1500);
  }

  // Si la pantalla se cierra mientras escucha, el micrófono se suelta (si no, el navegador lo sigue mostrando encendido)
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (precarga) clearTimeout(precarga);
      cancelar();
    });
  }

  return { estado, parcial, nivel, error, escuchando, alternar, terminar, cancelar };
}
