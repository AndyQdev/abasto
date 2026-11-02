import { initLlama, type LlamaContext, type RNLlamaOAICompatibleMessage } from 'llama.rn';
import { ESQUEMA_DE_INTENCION, instrucciones, leerRespuesta, type Contexto } from '../entender/con-modelo';
import { rutaDe, rutaParaElMotor } from './descargas';
import type { EntradaDelAsistente, Interprete } from './motor';
import type { ModeloLocal } from './modelos';

/**
 * Motor llama.cpp (llama.rn): corre cualquier modelo GGUF del manifiesto dentro del teléfono, sin internet.
 * Con proyector de visión (mmproj) entiende también fotos. La salida queda atada a `ESQUEMA_DE_INTENCION`.
 */
export async function cargarLlama(modelo: ModeloLocal, alCargar: (fraccion: number) => void = () => {}): Promise<Interprete> {
  const contexto: LlamaContext = await initLlama(
    {
      model: rutaParaElMotor(rutaDe(modelo, modelo.archivos.modelo)),
      n_ctx: modelo.contexto,
      use_mmap: true,
      // Con visión, llama.cpp no puede correr la ventana de contexto
      ctx_shift: false,
    },
    (p) => alCargar(p / 100),
  );
  let veFotos = false;
  if (modelo.archivos.proyector) {
    veFotos = await contexto
      .initMultimodal({ path: rutaParaElMotor(rutaDe(modelo, modelo.archivos.proyector)), image_max_tokens: 256 })
      .catch(() => false);
  }

  return {
    modelo,
    veFotos,
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
      const r = await contexto.completion({
        messages: [{ role: 'system', content: instrucciones(ctx) }, usuario],
        response_format: { type: 'json_schema', json_schema: { strict: true, schema: ESQUEMA_DE_INTENCION } },
        n_predict: 700,
        // Casi sin azar: se busca entender, no escribir creativo
        temperature: 0.1,
        enable_thinking: false,
      });
      return leerRespuesta(r.content || r.text);
    },
    async liberar() {
      await contexto.release();
    },
  };
}
