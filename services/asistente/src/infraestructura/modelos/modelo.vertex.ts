import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { ConsultaGenerada, ModeloDeLenguaje } from '../../reportes/puertos.js';

const SalidaConsulta = z.object({
  sql: z.string().describe('Una sola sentencia SELECT de PostgreSQL'),
  explicacion: z.string().describe('Qué muestra la consulta, en una oración, en español'),
  grafico: z.enum(['tabla', 'barras', 'linea']),
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
    const respuesta = await this.cliente.models.generateContent({
      model: this.nombre,
      contents: pregunta,
      config: {
        systemInstruction: instrucciones(esquema),
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(SalidaConsulta),
      },
    });
    const salida = SalidaConsulta.safeParse(leerJson(respuesta.text));
    if (!salida.success) throw new Error('El modelo no devolvió una consulta para esa pregunta');
    return salida.data;
  }
}

function leerJson(texto: string | undefined): unknown {
  try {
    return texto ? JSON.parse(texto) : undefined;
  } catch {
    return undefined;
  }
}
