import type { Propuesta } from './dominio/agente.js';

export interface RepositorioDePropuestas {
  guardar(propuesta: Propuesta): Promise<void>;
  buscar(orgId: string, id: string): Promise<Propuesta | null>;
  pendientes(orgId: string): Promise<Propuesta[]>;
}

/** Ejecuta una acción ya aprobada. En Abasto lo hace n8n (por ejemplo, mandar el WhatsApp). */
export interface EjecutorDeAcciones {
  ejecutar(propuesta: Propuesta): Promise<{ enviado: boolean; detalle: string }>;
}

export const REPOSITORIO_DE_PROPUESTAS = Symbol('RepositorioDePropuestas');
export const EJECUTOR_DE_ACCIONES = Symbol('EjecutorDeAcciones');
export const MISIONES = Symbol('Misiones');
