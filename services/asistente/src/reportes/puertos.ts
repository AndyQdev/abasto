import type { Plantilla } from './dominio/plantillas.js';

export type TipoDeGrafico = 'tabla' | 'barras' | 'linea';

/** Un bloque de la vista: la plantilla que eligió el modelo y la consulta que la llena. */
export interface BloqueGenerado {
  titulo: string;
  plantilla: Plantilla;
  sql: string;
}

export interface ConsultaGenerada {
  /** La del primer bloque: el que responde directo a la pregunta */
  sql: string;
  explicacion: string;
  grafico: TipoDeGrafico;
  /** La vista completa (10/11). Sin bloques, la respuesta es un solo bloque con `sql` y `grafico`. */
  bloques?: BloqueGenerado[];
}

/** Lo que el modelo lee en los resultados: hallazgos con cifras y, si se pidió consejo, recomendaciones. */
export interface Lectura {
  hallazgos: string[];
  recomendaciones: string[];
}

/** Un bloque ya respondido, como se le pasa al modelo para leerlo (los montos ya en bolivianos). */
export interface BloqueParaLeer {
  titulo: string;
  columnas: string[];
  filas: Record<string, unknown>[];
}

/** Puerto: el modelo de lenguaje que traduce una pregunta a SQL. Hay un adaptador real y uno simulado. */
export interface ModeloDeLenguaje {
  readonly nombre: string;
  generarConsulta(pregunta: string, esquema: string): Promise<ConsultaGenerada>;
  /** Opcional: si no está o falla, el reporte sale igual, sin lectura. */
  leerResultados?(pregunta: string, bloques: BloqueParaLeer[]): Promise<Lectura | null>;
}

/** El modelo no supo qué consulta arma la pregunta. Mejor decirlo que responder otra cosa. */
export class PreguntaNoEntendida extends Error {
  constructor(readonly ejemplos: string[]) {
    super('No entendí la pregunta');
  }
}

/**
 * La pregunta se puede responder de varias formas muy distintas («dame un reporte»): el modelo pregunta de vuelta
 * en vez de adivinar. `opciones` son preguntas completas que la persona puede elegir con un toque.
 */
export class FaltaPrecisar extends Error {
  constructor(
    readonly aclaracion: string,
    readonly opciones: string[],
  ) {
    super(aclaracion);
  }
}

/** El modelo de lenguaje no respondió (caído o colgado). No es culpa de la pregunta: se puede repetir. */
export class ModeloNoDisponible extends Error {}

export interface ResultadoDeConsulta {
  columnas: string[];
  filas: Record<string, unknown>[];
  /** true si había más de 1.000 filas y se cortó */
  truncado: boolean;
}

/** Quién pregunta: sale del token y decide qué filas se ven. */
export interface Solicitante {
  usuarioId: string;
  orgId: string;
}

/** Puerto: ejecuta una consulta ya validada como mcp_lector, con seguridad por fila. */
export interface ConsultorDeReportes {
  consultar(sql: string, solicitante: Solicitante): Promise<ResultadoDeConsulta>;
}

export interface RegistroDeAuditoria {
  orgId: string;
  usuarioId: string;
  origen: 'analista' | 'mcp' | 'agente' | 'tablero';
  sql: string;
  resultado: 'ok' | 'rechazada' | 'error';
  filas?: number;
  motivo?: string;
}

/** Puerto: cada consulta queda registrada; el Superadmin la muestra en Auditoría. */
export interface AuditoriaDeConsultas {
  registrar(registro: RegistroDeAuditoria): Promise<void>;
}

export const MODELO_DE_LENGUAJE = Symbol('ModeloDeLenguaje');
export const CONSULTOR_DE_REPORTES = Symbol('ConsultorDeReportes');
export const AUDITORIA_DE_CONSULTAS = Symbol('AuditoriaDeConsultas');
