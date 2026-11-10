import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { initLlama, type LlamaContext, type RNLlamaOAICompatibleMessage } from 'llama.rn';
import { ESQUEMA_DE_INTENCION, instrucciones, leerRespuesta, type Contexto } from '../entender/con-modelo';
import type { Intencion } from '../entender/intencion';
import { rutaDe, rutaParaElMotor } from './descargas';
import type { Diagnostico, EntradaDelAsistente, Interprete } from './motor';
import type { ModeloLocal } from './modelos';

/** En un teléfono el modelo corre en la CPU: más hilos que núcleos rápidos lo hace más lento, no más rápido */
const HILOS = 4;
/** Lado mayor de la foto que ve el modelo: una foto de cámara entera no cabe en el contexto («Not enough context space») */
const LADO_DE_LA_FOTO = 448;

/** Lo más largo que se le pasa escrito (una receta pegada de TikTok entra de sobra) */
const MAXIMO_DE_TEXTO = 2500;

const esFaltaDeContexto = (e: unknown) => /context space|context.*full|n_ctx|too long/i.test((e as Error)?.message ?? '');

/** La foto achicada (JPEG) para el proyector de visión: menos tokens, más rápido y siempre entra en el contexto. */
async function fotoParaElModelo(uri: string): Promise<string> {
  const { width, height } = await manipulateAsync(uri, []);
  if (Math.max(width, height) <= LADO_DE_LA_FOTO) return uri;
  const lado = width >= height ? { width: LADO_DE_LA_FOTO } : { height: LADO_DE_LA_FOTO };
  return (await manipulateAsync(uri, [{ resize: lado }], { compress: 0.85, format: SaveFormat.JPEG })).uri;
}

/**
 * Motor llama.cpp (llama.rn): corre cualquier modelo GGUF del manifiesto dentro del teléfono, sin internet.
 * Con proyector de visión (mmproj) entiende también fotos. La salida queda atada a `ESQUEMA_DE_INTENCION`.
 */
export async function cargarLlama(modelo: ModeloLocal, alCargar: (fraccion: number) => void = () => {}): Promise<Interprete> {
  const inicio = Date.now();
  const contexto: LlamaContext = await initLlama(
    {
      model: rutaParaElMotor(rutaDe(modelo, modelo.archivos.modelo)),
      // 4096: con 2048 la foto más las instrucciones no entraban (10/11)
      n_ctx: Math.min(modelo.contexto, 4096),
      n_threads: HILOS,
      use_mmap: true,
      // Con visión, llama.cpp no puede correr la ventana de contexto
      ctx_shift: false,
      // Solo CPU (10/11): en teléfonos con Snapdragon llama.rn carga la variante OpenCL y el compilador de la GPU
      // Adreno se cae al armar sus kernels (SIGSEGV en libllvm-qcom.so, Honor REA-NX9): la app se cerraba sola
      n_gpu_layers: 0,
      no_gpu_devices: true,
    },
    (p) => alCargar(p / 100),
  );
  let veFotos = false;
  if (modelo.archivos.proyector) {
    veFotos = await contexto
      .initMultimodal({ path: rutaParaElMotor(rutaDe(modelo, modelo.archivos.proyector)), image_max_tokens: 128, use_gpu: false })
      .catch((e: unknown) => {
        console.warn(`[ia] ${modelo.id}: no se pudo cargar la visión:`, (e as Error).message);
        return false;
      });
  }
  const cargaMs = Date.now() - inicio;
  let ultimo: Diagnostico | null = null;
  let fila: Promise<unknown> = Promise.resolve();

  return {
    modelo,
    veFotos,
    diagnostico: () => ultimo,
    interpretar(entrada: EntradaDelAsistente, ctx?: Contexto) {
      // Una pregunta a la vez: dos completions juntas sobre el mismo contexto se pisan
      const turno = fila.then(() => preguntar(entrada, ctx));
      fila = turno.catch(() => undefined);
      return turno;
    },
    elegir(fotoUri: string, pregunta: string, opciones: string[]) {
      const turno = fila.then(() => elegirDeLaLista(fotoUri, pregunta, opciones));
      fila = turno.catch(() => undefined);
      return turno;
    },
    async liberar() {
      await contexto.release();
    },
  };

  async function elegirDeLaLista(fotoUri: string, pregunta: string, opciones: string[]): Promise<string | null> {
    if (!veFotos || !opciones.length) return null;
    const empieza = Date.now();
    try {
      const foto = await fotoParaElModelo(fotoUri).catch(() => fotoUri);
      await contexto.clearCache(false).catch(() => undefined);
      const r = await contexto.completion({
        messages: [
          { role: 'system', content: `${pregunta} Responde solo con una de estas opciones, escrita igual: ${opciones.join(', ')}. Si no es ninguna, «ninguno».` },
          { role: 'user', content: [{ type: 'image_url', image_url: { url: rutaParaElMotor(foto) } }, { type: 'text', text: pregunta }] },
        ],
        jinja: false,
        add_generation_prompt: true,
        response_format: {
          type: 'json_schema',
          json_schema: { strict: true, schema: { type: 'object', additionalProperties: false, required: ['respuesta'], properties: { respuesta: { type: 'string', enum: [...opciones, 'ninguno'] } } } },
        },
        n_predict: 40,
        temperature: 0,
        enable_thinking: false,
      });
      const crudo = r.content || r.text;
      const respuesta = (JSON.parse(crudo) as { respuesta?: string }).respuesta ?? null;
      ultimo = { cargaMs, respuestaMs: Date.now() - empieza, crudo, error: null };
      return respuesta && opciones.includes(respuesta) ? respuesta : null;
    } catch (e) {
      ultimo = { cargaMs, respuestaMs: Date.now() - empieza, crudo: null, error: esFaltaDeContexto(e) ? 'La foto era muy grande para la IA del teléfono' : (e as Error).message };
      console.warn(`[ia] ${modelo.id} no pudo elegir:`, (e as Error).message);
      return null;
    }
  }

  async function preguntar(entrada: EntradaDelAsistente, ctx?: Contexto): Promise<Intencion | null> {
    const conFoto = veFotos && !!entrada.fotoUri;
    const foto = conFoto ? await fotoParaElModelo(entrada.fotoUri!).catch(() => entrada.fotoUri!) : null;
    // Una receta pegada muy larga tampoco debe llenar el contexto
    const texto = entrada.texto.slice(0, MAXIMO_DE_TEXTO);
    const mensajes = (conImagen: boolean): RNLlamaOAICompatibleMessage[] => [
      { role: 'system', content: instrucciones(ctx) },
      conImagen
        ? {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: rutaParaElMotor(foto!) } },
              { type: 'text', text: texto || '¿Qué es esto y qué necesito comprar?' },
            ],
          }
        : { role: 'user', content: texto || 'Describe qué necesito comprar.' },
    ];
    const empieza = Date.now();
    try {
      let r;
      try {
        r = await completar(mensajes(conFoto));
      } catch (e) {
        if (!esFaltaDeContexto(e)) throw e;
        // Se llenó igual: memoria limpia del todo y otra vez; si tampoco entra, sin la foto (las reglas y el
        // reconocedor propio ya miran la foto por su lado)
        console.warn(`[ia] ${modelo.id}: contexto lleno, se limpia y se reintenta`);
        await contexto.clearCache(true).catch(() => undefined);
        r = await completar(mensajes(conFoto)).catch(async (e2: unknown) => {
          if (!conFoto || !esFaltaDeContexto(e2)) throw e2;
          await contexto.clearCache(true).catch(() => undefined);
          return completar(mensajes(false));
        });
      }
      const crudo = r.content || r.text;
      const intencion = leerRespuesta(crudo);
      ultimo = { cargaMs, respuestaMs: Date.now() - empieza, crudo, error: intencion ? null : 'La IA respondió algo que no se pudo leer como pedido' };
      if (!intencion) console.warn(`[ia] ${modelo.id} respondió algo que no se pudo leer:`, crudo.slice(0, 400));
      return intencion;
    } catch (e) {
      const mensaje = esFaltaDeContexto(e) ? 'La foto o el texto eran muy grandes para la IA del teléfono' : (e as Error).message;
      ultimo = { cargaMs, respuestaMs: Date.now() - empieza, crudo: null, error: mensaje };
      console.warn(`[ia] ${modelo.id} falló:`, (e as Error).message);
      return null;
    }
  }

  /**
   * Cada pregunta empieza con la memoria vacía. LFM2 es un modelo híbrido (estado recurrente): llama.rn no puede
   * quitar solo una parte de su caché y, sin limpiarla, las preguntas se van sumando hasta «Not enough context
   * space» (10/11, Honor REA-NX9). Cada pregunta es independiente: no se pierde nada.
   */
  async function completar(messages: RNLlamaOAICompatibleMessage[]) {
    await contexto.clearCache(false).catch(() => undefined);
    return contexto.completion({
      messages,
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
  }
}
