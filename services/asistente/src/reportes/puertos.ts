export type TipoDeGrafico = 'tabla' | 'barras' | 'linea';

export interface ConsultaGenerada {
  sql: string;
  explicacion: string;
  grafico: TipoDeGrafico;
}

/** Puerto: el modelo de lenguaje que traduce una pregunta a SQL. Hay un adaptador real y uno simulado. */
export interface ModeloDeLenguaje {
  readonly nombre: string;
  generarConsulta(pregunta: string, esquema: string): Promise<ConsultaGenerada>;
}

/** El modelo no supo qué consulta arma la pregunta. Mejor decirlo que responder otra cosa. */
export class PreguntaNoEntendida extends Error {
  constructor(readonly ejemplos: string[]) {
    super('No entendí la pregunta');
  }
}

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
