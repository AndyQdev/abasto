import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { ConsultaGenerada, ModeloDeLenguaje } from '../../reportes/puertos.js';

const SalidaConsulta = z.object({
  sql: z.string().describe('Una sola sentencia SELECT de PostgreSQL'),
  explicacion: z.string().describe('Qué muestra la consulta, en una oración, en español'),
  grafico: z.enum(['tabla', 'barras', 'linea']),
});

const instrucciones = (esquema: string) => `Eres el Analista de Abasto, una red mayorista de Bolivia.
Conviertes la pregunta de un mayorista en UNA consulta SELECT de PostgreSQL sobre estas tablas:

${esquema}

Reglas:
- Solo SELECT. Nada de INSERT, UPDATE, DELETE, DDL ni funciones de administración.
- No filtres por org_id: la base ya muestra solo los datos de quien pregunta.
- Los montos están en centavos; deja los centavos como vienen y nómbralos con el sufijo _centavos.
- Las fechas relativas ("mañana", "este mes") se resuelven con current_date.
- Si la pregunta no se puede responder con estas tablas, devuelve SELECT 'Sin datos para esa pregunta' AS aviso.`;

/**
 * Adaptador real. El modelo se cambia con ASISTENTE_MODELO; el resto de Asistente no sabe qué proveedor hay detrás.
 * Usa la respuesta estructurada de la API, así que el SQL llega en un campo y no hay que buscarlo dentro de un texto.
 * Con `fallbacks: 'default'`, si el modelo declina por política la API reintenta sola en el modelo de respaldo.
 */
export class ModeloAnthropic implements ModeloDeLenguaje {
  readonly nombre: string;
  private readonly cliente = new Anthropic();

  constructor(modelo = process.env.ASISTENTE_MODELO ?? 'claude-opus-5-5') {
    this.nombre = modelo;
  }

  async generarConsulta(pregunta: string, esquema: string): Promise<ConsultaGenerada> {
    const respuesta = await this.cliente.beta.messages.parse({
      model: this.nombre,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      max_tokens: 16000,
      system: instrucciones(esquema),
      messages: [{ role: 'user', content: pregunta }],
      output_config: { effort: 'medium', format: betaZodOutputFormat(SalidaConsulta) },
    });
    if (respuesta.stop_reason === 'refusal' || !respuesta.parsed_output) {
      throw new Error('El modelo no devolvió una consulta para esa pregunta');
    }
    return respuesta.parsed_output;
  }
}
