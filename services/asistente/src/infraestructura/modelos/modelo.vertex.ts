import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { graficoDe, PLANTILLAS } from '../../reportes/dominio/plantillas.js';
import {
  FaltaPrecisar,
  ModeloNoDisponible,
  type BloqueParaLeer,
  type ConsultaGenerada,
  type Lectura,
  type ModeloDeLenguaje,
} from '../../reportes/puertos.js';

const Bloque = z.object({
  plantilla: z.enum(PLANTILLAS),
  titulo: z.string().describe('Título corto del bloque, en español, por ejemplo «Ventas por semana»'),
  sql: z.string().describe('Una sola sentencia SELECT de PostgreSQL que llena esta plantilla'),
});

const SalidaConsulta = z.object({
  explicacion: z.string().describe('Qué muestra el reporte, en una oración, en español'),
  bloques: z
    .array(Bloque)
    .max(5)
    .describe('De 1 a 5 bloques; el primero responde directo a la pregunta. Vacío solo si hay que pedir una aclaración'),
  aclaracion: z.string().optional().describe('Solo si la pregunta es ambigua: lo que hay que preguntarle, con tuteo'),
  opciones: z
    .array(z.string())
    .max(4)
    .optional()
    .describe('Con la aclaración: 2 a 4 preguntas completas que sí se pueden responder'),
});

/** Lo que se acepta de vuelta: sin topes de cantidad (se recortan) y las recomendaciones pueden faltar. */
const LecturaRecibida = z.object({ hallazgos: z.array(z.string()), recomendaciones: z.array(z.string()).optional() });

const SalidaLectura = z.object({
  hallazgos: z.array(z.string()).max(4).describe('2 a 4 frases cortas con lo más importante, cada una con una cifra de los datos'),
  recomendaciones: z
    .array(z.string())
    .max(3)
    .describe('Solo si la pregunta pide consejo o cómo mejorar: 1 a 3 acciones concretas. Si no, vacío'),
});

export const instrucciones = (esquema: string) => `Eres el Analista de Abasto, una red mayorista de Bolivia.
Quien pregunta es un mayorista (o Abasto, que vende como mayorista de la casa) mirando SU negocio.
«Mi negocio», «mi tienda», «mi empresa», «yo», «vendí», «me deben» son su propia empresa: las tablas ya traen
solo sus datos, nunca los de otras empresas. Las «tiendas» son sus clientes, las que le compran.

Con la pregunta armas una VISTA de 1 a 5 bloques. Cada bloque es una plantilla que se llena con UNA consulta
SELECT de PostgreSQL sobre estas tablas:

${esquema}

Plantillas:
- kpis: una sola fila con 1 a 4 números; cada columna es una tarjeta. Para comparar con el período anterior agrega
  la misma columna con el sufijo _anterior (ventas_centavos y ventas_centavos_anterior) y la tarjeta muestra cuánto cambió.
  Ejemplo, últimos 30 días contra los 30 anteriores:
  SELECT sum(CASE WHEN fecha > current_date - 30 THEN total_centavos ELSE 0 END) AS ventas_centavos,
         sum(CASE WHEN fecha <= current_date - 30 THEN total_centavos ELSE 0 END) AS ventas_centavos_anterior
    FROM ventas_diarias WHERE fecha > current_date - 60
- linea: cómo cambia algo en el tiempo. Primera columna el período (fecha, semana o mes, de lo viejo a lo nuevo),
  después 1 o 2 columnas con números. Al menos 3 puntos.
- barras: ranking o comparación entre nombres. Una columna de nombre y una de número, de mayor a menor, con LIMIT 12 o menos.
- dona: cómo se reparte un total (cómo me pagan, pedidos por estado, tiendas por segmento). Una columna de nombre y un
  número que se pueda sumar, de 2 a 8 filas. Nunca promedios ni porcentajes ya calculados.
- tabla: un listado con detalle para actuar (qué cuentas vencen, pedidos rechazados y su motivo).

Qué plantilla usar:
- Un dato («cuánto vendí este mes», «cuántos pedidos tuve hoy») → kpis, comparado con el período anterior.
  Puedes sumar una linea del período si ayuda a entenderlo.
- Cómo cambia en el tiempo («cada semana», «por mes», «cómo van mis ventas») → linea.
- Quién o qué más o menos («qué tiendas me deben más», «productos más vendidos») → barras.
- Cómo se reparte («cómo me pagan», «pedidos por estado») → dona.
- Un listado para actuar → tabla.
El PRIMER bloque responde directo a la pregunta. Para una pregunta puntual usa 1 o 2 bloques: no rellenes.

Las preguntas generales sobre el negocio («cómo va mi negocio», «dame un resumen», «cómo vendo más», «qué me
recomiendas», «cómo mejoro mi tienda») NO son ambiguas: arma un diagnóstico de 4 o 5 bloques:
  1. kpis de los últimos 30 días contra los 30 anteriores: ventas_centavos, pedidos y ticket_promedio_centavos, con sus _anterior.
  2. linea de ventas por semana de las últimas 12 semanas (date_trunc('week', fecha)::date AS semana).
  3. barras de los 10 productos que más vendieron en 30 días (ventas_por_producto).
  4. dona de cómo te pagan en 30 días (pedidos no rechazados por metodo_pago, sumando total_centavos).
  5. tabla de tiendas que compraban y dejaron de comprar: compraron en los últimos 90 días pero no en los últimos 30,
     con su última compra y cuánto compraron.

Reglas:
- Solo SELECT. Nada de INSERT, UPDATE, DELETE, DDL ni funciones de administración. Para condiciones usa CASE WHEN, no FILTER.
- No filtres por org_id: la base ya muestra solo los datos de quien pregunta.
- Los montos están en centavos; deja los centavos como vienen y nómbralos con el sufijo _centavos.
- Las fechas relativas ("mañana", "este mes") se resuelven con current_date. Los últimos N días incluyen hoy: fecha > current_date - N.
- Si no hay el dato exacto pero sí uno cercano (por ejemplo, un promedio de 30 días en lugar del mes calendario), úsalo y dilo en la explicación.
- Si falta solo el período, no preguntes: usa los últimos 30 días (o el mes en curso) y dilo en la explicación.
- Si la pregunta no dice qué medir y se puede entender de formas muy distintas (por ejemplo «dame un reporte» o «¿y la otra?»),
  no adivines: deja bloques vacío, pon en aclaracion lo que necesitas saber y en opciones 2 a 4 preguntas completas que sí puedas responder.
- Solo si la pregunta no se puede responder con estas tablas, devuelve un bloque tabla con SELECT 'Sin datos para esa pregunta' AS aviso.`;

export const instruccionesDeLectura = `Eres el Analista de Abasto, una red mayorista de Bolivia. Un mayorista hizo una pregunta sobre su
negocio y ya tienes los datos que la responden, en bloques. Escribe lo que un dueño de negocio tiene que saber.
- hallazgos: 2 a 4 frases cortas, cada una con una cifra que esté en los datos. No inventes cifras; la única cuenta
  permitida es la variación porcentual entre una columna y su _anterior de la misma fila. Montos como «Bs 1.728,00».
- recomendaciones: solo si la pregunta pide consejo, cómo vender más o cómo mejorar. 1 a 3 acciones concretas que
  salgan de los datos (por ejemplo, llamar a las tiendas que dejaron de comprar o reponer lo que más se vende).
  Si la pregunta no pide consejo, deja la lista vacía.
- Español de Bolivia, con tuteo, nunca voseo. Habla de «tus ventas», «tus tiendas».`;

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
 * Pide la respuesta como JSON con esquema fijo, así cada SQL llega en su campo y no hay que buscarlo en un texto;
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
    const respuesta = await this.pedirConUnReintento(pregunta, instrucciones(esquema), SalidaConsulta);
    const salida = SalidaConsulta.safeParse(leerJson(respuesta.text));
    if (!salida.success) throw new Error('El modelo no devolvió una consulta para esa pregunta');
    const { explicacion, aclaracion, opciones } = salida.data;
    if (aclaracion?.trim()) throw new FaltaPrecisar(aclaracion.trim(), opciones ?? []);
    const bloques = salida.data.bloques.filter((b) => b.sql.trim());
    if (!bloques.length) throw new Error('El modelo no devolvió una consulta para esa pregunta');
    return { sql: bloques[0].sql, explicacion, grafico: graficoDe(bloques[0].plantilla), bloques };
  }

    /** Una sola vez y con tope corto: si no llega, el reporte sale igual, sin lectura. */
  async leerResultados(pregunta: string, bloques: BloqueParaLeer[]): Promise<Lectura | null> {
    const contenido = `Pregunta: ${pregunta}\n\nDatos:\n${JSON.stringify(bloques)}`;
    // gemini-3.8-flash no acepta MINIMAL (400): va con LOW como la consulta, con más tope porque lee 5 bloques
    const respuesta = await this.pedir(contenido, instruccionesDeLectura, SalidaLectura, 25_000);
    // Tolerante: si el modelo escribe de más, se recorta en vez de perder toda la lectura
    const salida = LecturaRecibida.safeParse(leerJson(respuesta.text));
    if (!salida.success) {
      console.warn(`[Analista] La lectura no llegó como se esperaba: ${String(respuesta.text).slice(0, 200)}`);
      return null;
    }
    const limpias = (xs: string[], n: number) => xs.map((x) => x.trim()).filter(Boolean).slice(0, n);
    return { hallazgos: limpias(salida.data.hallazgos, 4), recomendaciones: limpias(salida.data.recomendaciones ?? [], 3) };
  }

  /**
   * Vertex casi siempre responde en 3 a 5 s, pero de vez en cuando un pedido se queda colgado hasta el tope
   * (504 DEADLINE_EXCEEDED). Repetirlo una vez casi siempre sale al toque; si vuelve a fallar, avisa.
   */
  private async pedirConUnReintento(contenido: string, sistema: string, salida: z.ZodType) {
    try {
      return await this.pedir(contenido, sistema, salida);
    } catch {
      try {
        return await this.pedir(contenido, sistema, salida);
      } catch (e) {
        throw new ModeloNoDisponible((e as Error).message);
      }
    }
  }

  private pedir(contenido: string, sistema: string, salida: z.ZodType, tope = 20_000) {
    return this.cliente.models.generateContent({
      model: this.nombre,
      contents: contenido,
      config: {
        systemInstruction: sistema,
        temperature: 0,
        // Por defecto Gemini 3 piensa mucho y tardaba hasta 140 s. Con LOW tarda 3 a 5 s y el SQL sale igual
        // de bien (vendfy usa lo mismo). El tope corta los pedidos colgados para reintentar.
        thinkingConfig: { thinkingLevel: 'LOW' },
        httpOptions: { timeout: tope },
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(salida),
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
