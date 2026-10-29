import { computed, ref } from 'vue';
import { grabarDelMicrofono, type Grabacion, type IniciarGrabacion } from './grabadora';
import { audioParaWhisper, transcriptorWhisper, type Transcriptor } from './transcriptor';

export type EstadoDeVoz = 'lista' | 'grabando' | 'transcribiendo';

export interface DependenciasDeVoz {
  grabar: IniciarGrabacion;
  convertir: (grabacion: Blob) => Promise<Float32Array>;
  transcriptor: Transcriptor;
}

const REALES: DependenciasDeVoz = { grabar: grabarDelMicrofono, convertir: audioParaWhisper, transcriptor: transcriptorWhisper };

/**
 * Botón de micrófono: primer clic graba, segundo clic transcribe y entrega el texto.
 * Las dependencias se pueden cambiar en las pruebas (no hay micrófono ni modelo en jsdom).
 */
export function usarVoz(alTranscribir: (texto: string) => void, dependencias: DependenciasDeVoz = REALES) {
  const estado = ref<EstadoDeVoz>('lista');
  const error = ref<string | null>(null);
  let grabacion: Grabacion | null = null;

  const textoDelBoton = computed(
    () => ({ lista: 'Hablar', grabando: 'Detener y preguntar', transcribiendo: 'Escuchando…' })[estado.value],
  );

  async function alternar() {
    error.value = null;
    if (estado.value === 'lista') {
      try {
        grabacion = await dependencias.grabar();
        estado.value = 'grabando';
      } catch (e) {
        error.value = (e as Error).message;
      }
      return;
    }
    if (estado.value !== 'grabando' || !grabacion) return;

    estado.value = 'transcribiendo';
    try {
      const audio = await dependencias.convertir(await grabacion.detener());
      const texto = await dependencias.transcriptor.transcribir(audio);
      if (texto.length < 3) error.value = 'No te entendí. Habla un poco más cerca del micrófono y vuelve a intentar.';
      else alTranscribir(texto);
    } catch {
      error.value = 'No se pudo transcribir. La primera vez se necesita internet para bajar el modelo de voz.';
    } finally {
      grabacion = null;
      estado.value = 'lista';
    }
  }

  return { estado, error, textoDelBoton, alternar };
}
