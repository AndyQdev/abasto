import type { ModeloLocal } from './modelos';

export interface Progreso {
  bajados: number;
  total: number;
  fraccion: number;
}

export const estaInstalado = async (_m: ModeloLocal) => false;
export async function descargarModelo(_m: ModeloLocal, _alAvanzar?: (p: Progreso) => void): Promise<void> {
  throw new Error('Los modelos se bajan en el teléfono');
}
export const cancelarDescarga = async () => {};
export const borrarModelo = async (_m: ModeloLocal) => {};
