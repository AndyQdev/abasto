import type { Contexto } from '../entender/con-modelo';
import type { Intencion } from '../entender/intencion';
import type { ModeloLocal } from './modelos';

export interface EntradaDelAsistente {
  /** Lo que escribió, dictó o pegó (una lista, una receta copiada de TikTok…) */
  texto: string;
  /** Foto del teléfono (file://…): un producto, una lista escrita a mano, una torta */
  fotoUri?: string | null;
}

/** Lo que pasó la última vez: para ver en la app por qué el modelo no respondió y cuánto tardó */
export interface Diagnostico {
  cargaMs: number;
  respuestaMs: number;
  crudo: string | null;
  error: string | null;
}

/**
 * Quien interpreta lo que pide la persona. Hoy lo implementa llama.rn con cualquier modelo GGUF del manifiesto;
 * otro motor (LiteRT-LM, ExecuTorch…) solo tiene que cumplir esto. Devuelve null si no pudo entender: se usan las reglas.
 */
export interface Interprete {
  readonly modelo: ModeloLocal;
  /** Si el modelo cargado entiende fotos (tiene proyector de visión) */
  readonly veFotos: boolean;
  interpretar(entrada: EntradaDelAsistente, contexto?: Contexto): Promise<Intencion | null>;
  diagnostico(): Diagnostico | null;
  liberar(): Promise<void>;
}
