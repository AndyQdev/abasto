import type { Propuesta } from './dominio/agente.js';

export interface RepositorioDePropuestas {
  guardar(propuesta: Propuesta): Promise<void>;
  buscar(orgId: string, id: string): Promise<Propuesta | null>;
  pendientes(orgId: string): Promise<Propuesta[]>;
}

/** Lo que pasó al ejecutar una acción aprobada; `enlace` es, por ejemplo, el WhatsApp listo para mandar. */
export interface ResultadoDeAccion {
  enviado: boolean;
  detalle: string;
  enlace?: string;
}

/**
 * Ejecuta una acción ya aprobada. En Abasto lo hace n8n (pausar en Catálogo, preparar el WhatsApp…).
 * `sesion` es el token de quien aprobó: la acción se hace a su nombre y con sus permisos, nunca con más.
 */
export interface EjecutorDeAcciones {
  ejecutar(propuesta: Propuesta, sesion?: string): Promise<ResultadoDeAccion>;
}

export const REPOSITORIO_DE_PROPUESTAS = Symbol('RepositorioDePropuestas');
export const EJECUTOR_DE_ACCIONES = Symbol('EjecutorDeAcciones');
export const MISIONES = Symbol('Misiones');
