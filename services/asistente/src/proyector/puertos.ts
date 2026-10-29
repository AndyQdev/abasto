/**
 * Puerto: de dónde salen los nombres de las tiendas. Los eventos de Pedidos solo traen el id
 * y los reportes se leen con nombres. El adaptador pregunta a Catálogo (dueño de las tiendas).
 * Nunca falla: si no sabe un nombre, devuelve el id para que la proyección siga.
 */
export interface DirectorioDeTiendas {
  nombres(tiendaIds: string[]): Promise<Record<string, string>>;
}

export const DIRECTORIO_DE_TIENDAS = Symbol('DirectorioDeTiendas');
