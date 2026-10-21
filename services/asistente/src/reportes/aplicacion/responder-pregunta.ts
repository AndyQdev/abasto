import { describirEsquema } from '../dominio/esquema.js';
import type { ModeloDeLenguaje, ResultadoDeConsulta, Solicitante, TipoDeGrafico } from '../puertos.js';
import type { ConsultarReportes } from './consultar-reportes.js';

export interface Respuesta extends ResultadoDeConsulta {
  pregunta: string;
  sql: string;
  explicacion: string;
  grafico: TipoDeGrafico;
  modelo: string;
}

/** Reporte generativo: pregunta en lenguaje natural (escrita o transcrita de la voz) → SQL → tabla. */
export class ResponderPregunta {
  constructor(
    private readonly modelo: ModeloDeLenguaje,
    private readonly reportes: ConsultarReportes,
  ) {}

  async ejecutar(pregunta: string, solicitante: Solicitante): Promise<Respuesta> {
    const generada = await this.modelo.generarConsulta(pregunta, describirEsquema());
    const resultado = await this.reportes.ejecutar(generada.sql, solicitante, 'analista');
    return { pregunta, ...generada, ...resultado, modelo: this.modelo.nombre };
  }
}
