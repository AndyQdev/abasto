import type { Interprete } from './motor';
import type { ModeloLocal } from './modelos';

/** En la vista web de desarrollo no hay llama.rn: la IA usa las reglas. */
export async function cargarLlama(_modelo: ModeloLocal): Promise<Interprete> {
  throw new Error('El modelo local solo corre en el teléfono');
}
