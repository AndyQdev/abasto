import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { FaltaPrecisar, ModeloNoDisponible, type ConsultaGenerada, type ModeloDeLenguaje } from '../../reportes/puertos.js';

const SalidaConsulta = z.object({
  sql: z.string().describe('Una sola sentencia SELECT de PostgreSQL; vacío solo si hay que pedir una aclaración'),
  explicacion: z.string().describe('Qué muestra la consulta, en una oración, en español'),
  grafico: z.enum(['tabla', 'barras', 'linea']),
  aclaracion: z.string().optional().describe('Solo si la pregunta es ambigua: lo que hay que preguntarle, con tuteo'),
  opciones: z
    .array(z.string())
    .max(4)
    .optional()
    .describe('Con la aclaración: 2 a 4 preguntas completas que sí se pueden responder'),
});

export const instrucciones = (esquema: string) => `Eres el Analista de Abasto, una red mayorista de Bolivia.
Conviertes la pregunta de un mayorista en UNA consulta SELECT de PostgreSQL sobre estas tablas:

${esquema}

Reglas:
- Solo SELECT. Nada de INSERT, UPDATE, DELETE, DDL ni funciones de administración.
- No filtres por org_id: la base ya muestra solo los datos de quien pregunta.
- Los montos están en centavos; deja los centavos como vienen y nómbralos con el sufijo _centavos.
- Las fechas relativas ("mañana", "este mes") se resuelven con current_date.
- Si no hay el dato exacto pero sí uno cercano (por ejemplo, un promedio de 30 días en lugar del mes calendario), úsalo y dilo en la explicación.
- Si falta solo el período, no preguntes: usa los últimos 30 días (o el mes en curso) y dilo en la explicación.
- Si la pregunta no dice qué medir y se puede entender de formas muy distintas (por ejemplo «dame un reporte» o «¿y la otra?»),
  no adivines: deja sql vacío, pon en aclaracion lo que necesitas saber y en opciones 2 a 4 preguntas completas que sí puedas responder.
- Solo si la pregunta no se puede responder con estas tablas, devuelve SELECT 'Sin datos para esa pregunta' AS aviso.`;

/** Lo único del SDK que usa el adaptador; en las pruebas se reemplaza por uno falso. */
export interface ClienteGemini {
  models: {
    generateContent(pedido: {
      model: string;
      contents: string;
      config: Record<string, unknown>;
    }): Promise<{ text?: string }>;
  };
}

/** Variables con las que se activa Vertex AI. Sin proyecto ni llave, Asistente usa el modelo simulado. */
export const hayVertex = (env: NodeJS.ProcessEnv = process.env) =>
  Boolean(env.GOOGLE_CLOUD_PROJECT || env.VERTEX_API_KEY);

/**
 * Cliente de Vertex AI. Dos formas de entrar:
 * - Cuenta de servicio (lo normal fuera de Google, como en Azure): GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION
 *   y GOOGLE_APPLICATION_CREDENTIALS con la ruta del JSON de la cuenta.
 * - Llave de API de Vertex (modo express): VERTEX_API_KEY.
 */
export const crearClienteVertex = (env: NodeJS.ProcessEnv = process.env): ClienteGemini =>
  env.VERTEX_API_KEY
    ? new GoogleGenAI({ vertexai: true, apiKey: env.VERTEX_API_KEY })
    : new GoogleGenAI({
        vertexai: true,
        project: env.GOOGLE_CLOUD_PROJECT,
        location: env.GOOGLE_CLOUD_LOCATION ?? 'global',
      });

/**
 * Adaptador real: Gemini en Vertex AI. El modelo se cambia con ASISTENTE_MODELO; el resto de Asistente
 * no sabe qué proveedor hay detrás.
 * Pide la respuesta como JSON con esquema fijo, así el SQL llega en un campo y no hay que buscarlo en un texto;
 * igual se valida con zod antes de devolverla.
 */
export class ModeloVertex implements ModeloDeLenguaje {
  readonly nombre: string;

  constructor(
    private readonly cliente: ClienteGemini = crearClienteVertex(),
    modelo = process.env.ASISTENTE_MODELO ?? 'gemini-3.8-flash',
  ) {
    this.nombre = modelo;
  }

  async generarConsulta(pregunta: string, esquema: string): Promise<ConsultaGenerada> {
    const respuesta = await this.pedirConUnReintento(pregunta, esquema);
    const salida = SalidaConsulta.safeParse(leerJson(respuesta.text));
    if (!salida.success) throw new Error('El modelo no devolvió una consulta para esa pregunta');
    const { sql, explicacion, grafico, aclaracion, opciones } = salida.data;
    if (aclaracion?.trim()) throw new FaltaPrecisar(aclaracion.trim(), opciones ?? []);
    if (!sql.trim()) throw new Error('El modelo no devolvió una consulta para esa pregunta');
    return { sql, explicacion, grafico };
  }

  /**
   * Vertex casi siempre responde en 3 a 5 s, pero de vez en cuando un pedido se queda colgado hasta el tope
   * (504 DEADLINE_EXCEEDED). Repetirlo una vez casi siempre sale al toque; si vuelve a fallar, avisa.
   */
  private async pedirConUnReintento(pregunta: string, esquema: string) {
    try {
      return await this.pedir(pregunta, esquema);
    } catch {
      try {
        return await this.pedir(pregunta, esquema);
      } catch (e) {
        throw new ModeloNoDisponible((e as Error).message);
      }
    }
  }

  private pedir(pregunta: string, esquema: string) {
    return this.cliente.models.generateContent({
      model: this.nombre,
      contents: pregunta,
      config: {
        systemInstruction: instrucciones(esquema),
        temperature: 0,
        // Por defecto Gemini 3 piensa mucho y tardaba hasta 140 s. Con LOW tarda 3 a 5 s y el SQL sale igual
        // de bien (vendfy usa lo mismo). El tope corta los pedidos colgados para reintentar.
        thinkingConfig: { thinkingLevel: 'LOW' },
        httpOptions: { timeout: 20_000 },
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(SalidaConsulta),
      },
    });
  }
}

function leerJson(texto: string | undefined): unknown {
  try {
    return texto ? JSON.parse(texto) : undefined;
  } catch {
    return undefined;
  }
}
