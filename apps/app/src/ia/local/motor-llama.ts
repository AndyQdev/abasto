import { initLlama, type LlamaContext, type RNLlamaOAICompatibleMessage } from 'llama.rn';
import { ESQUEMA_DE_INTENCION, instrucciones, leerRespuesta, type Contexto } from '../entender/con-modelo';
import { rutaDe, rutaParaElMotor } from './descargas';
import type { Diagnostico, EntradaDelAsistente, Interprete } from './motor';
import type { ModeloLocal } from './modelos';

/** En un teléfono el modelo corre en la CPU: más hilos que núcleos rápidos lo hace más lento, no más rápido */
const HILOS = 4;

/**
 * Motor llama.cpp (llama.rn): corre cualquier modelo GGUF del manifiesto dentro del teléfono, sin internet.
 * Con proyector de visión (mmproj) entiende también fotos. La salida queda atada a `ESQUEMA_DE_INTENCION`.
 */
export async function cargarLlama(modelo: ModeloLocal, alCargar: (fraccion: number) => void = () => {}): Promise<Interprete> {
  const inicio = Date.now();
  const contexto: LlamaContext = await initLlama(
    {
      model: rutaParaElMotor(rutaDe(modelo, modelo.archivos.modelo)),
      n_ctx: Math.min(modelo.contexto, 2048),
      n_threads: HILOS,
      use_mmap: true,
      // Con visión, llama.cpp no puede correr la ventana de contexto
      ctx_shift: false,
    },
    (p) => alCargar(p / 100),
  );
  let veFotos = false;
  if (modelo.archivos.proyector) {
    veFotos = await contexto
      .initMultimodal({ path: rutaParaElMotor(rutaDe(modelo, modelo.archivos.proyector)), image_max_tokens: 128 })
      .catch(() => false);
  }
  const cargaMs = Date.now() - inicio;
  let ultimo: Diagnostico | null = null;

  return {
    modelo,
    veFotos,
    diagnostico: () => ultimo,
    async interpretar(entrada: EntradaDelAsistente, ctx?: Contexto) {
      const conFoto = veFotos && !!entrada.fotoUri;
      const usuario: RNLlamaOAICompatibleMessage = conFoto
        ? {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: rutaParaElMotor(entrada.fotoUri!) } },
              { type: 'text', text: entrada.texto || '¿Qué es esto y qué necesito comprar?' },
            ],
          }
        : { role: 'user', content: entrada.texto };
      const empieza = Date.now();
      try {
        const r = await contexto.completion({
          messages: [{ role: 'system', content: instrucciones(ctx) }, usuario],
          // Sin jinja: llama.rn arma el prompt con la plantilla clásica y aplica el esquema como gramática estricta
          // desde el primer carácter (con jinja la gramática venía de la plantilla y el modelo escribía libre)
          jinja: false,
          add_generation_prompt: true,
          response_format: { type: 'json_schema', json_schema: { strict: true, schema: ESQUEMA_DE_INTENCION } },
          n_predict: 400,
          // Casi sin azar: se busca entender, no escribir creativo
          temperature: 0.1,
          enable_thinking: false,
        });
        const crudo = r.content || r.text;
        const intencion = leerRespuesta(crudo);
        ultimo = { cargaMs, respuestaMs: Date.now() - empieza, crudo, error: intencion ? null : 'La respuesta no se pudo leer como pedido' };
        if (!intencion) console.warn(`[ia] ${modelo.id} respondió algo que no se pudo leer:`, crudo.slice(0, 400));
        return intencion;
      } catch (e) {
        ultimo = { cargaMs, respuestaMs: Date.now() - empieza, crudo: null, error: (e as Error).message };
        console.warn(`[ia] ${modelo.id} falló:`, (e as Error).message);
        return null;
      }
    },
    async liberar() {
      await contexto.release();
    },
  };
}
