import type { Capacidades } from './modelos';

/** En la vista web de desarrollo no hay motor nativo: se usan las reglas. */
export async function capacidadesDelTelefono(): Promise<Capacidades> {
  return { memoriaMb: null, arquitecturas: [], espacioLibreMb: null };
}

export const nombreDelTelefono = () => 'Navegador';
