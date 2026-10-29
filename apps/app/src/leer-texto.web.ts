/** En la vista web no hay ML Kit: leer una foto es cosa de la app del teléfono. */
export async function leerTexto(_uri: string): Promise<string> {
  throw new Error('Leer una foto funciona en la app del teléfono. Aquí escribe lo que buscas en Buscar.');
}
