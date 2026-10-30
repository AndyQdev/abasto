/**
 * IA local de la app (dueño: Jhoel). Las pantallas (de Andrés) solo importan desde aquí.
 * Todo corre dentro del teléfono y sin internet: ML Kit para leer texto y TFLite para los modelos propios.
 * Si cambias lo que exporta este archivo, avísale a Andrés en docs/equipo/jhoel.md.
 */
export { leerTexto } from './leer-texto';
export { Diagnostico } from './diagnostico';
export { leerPrecio, enBolivianos } from './precio';
export { reconocerProducto } from './reconocer';
export { combinarConTexto, type Reconocido } from './parecido';
