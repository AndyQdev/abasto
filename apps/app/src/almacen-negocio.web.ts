import type { AlmacenDeNegocio, Articulo, DatosDeNegocio, Movimiento } from '@abasto/comercio';
import { guardado } from './guardado';

/**
 * En la vista web de desarrollo no hay SQLite: el inventario va a AsyncStorage (localStorage), con las mismas reglas
 * que en el teléfono (un artículo por id y un movimiento por clave única).
 */
class AlmacenDeNegocioWeb implements AlmacenDeNegocio {
  constructor(private readonly dueno: string) {}

  private clave = () => `mi-negocio:${this.dueno}`;

  async leer(): Promise<DatosDeNegocio> {
    return (await guardado.leer<DatosDeNegocio>(this.clave())) ?? { articulos: [], movimientos: [] };
  }

  async guardar({ articulos = [], movimientos = [] }: { articulos?: Articulo[]; movimientos?: Movimiento[] }) {
    const datos = await this.leer();
    const porId = new Map(datos.articulos.map((a) => [a.id, a]));
    for (const a of articulos) porId.set(a.id, a);
    const claves = new Set(datos.movimientos.map((m) => m.claveUnica));
    const nuevos = movimientos.filter((m) => !claves.has(m.claveUnica) && claves.add(m.claveUnica));
    await guardado.escribir(this.clave(), { articulos: [...porId.values()], movimientos: [...datos.movimientos, ...nuevos] });
  }
}

export const almacenDeNegocio = (dueno: string): AlmacenDeNegocio => new AlmacenDeNegocioWeb(dueno);
