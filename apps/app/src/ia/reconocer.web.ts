import type { Reconocido } from './parecido';

/** En la vista web de desarrollo no hay TFLite: no reconoce nada y la pantalla usa solo el texto. */
export async function reconocerProducto(_fotoUri: string, _maximo = 5): Promise<Reconocido[]> {
  return [];
}
