import { datosVacios, fusionar, type CambiosDeNegocio, type DatosDeNegocio } from '@abasto/comercio';
import { type AlmacenLocal } from './almacen-local';
import { guardado } from './guardado';

/**
 * En la vista web de desarrollo no hay SQLite: la copia, la cola y la marca van a AsyncStorage (localStorage), con
 * las mismas reglas que en el teléfono.
 */
class AlmacenDeNegocioWeb implements AlmacenLocal {
  constructor(private readonly dueno: string) {}

  private clave = (que: string) => `mi-negocio:${this.dueno}:${que}`;

  async leer(): Promise<DatosDeNegocio> {
    return { ...datosVacios(), ...((await guardado.leer<DatosDeNegocio>(this.clave('datos'))) ?? {}) };
  }

  async guardar(cambios: CambiosDeNegocio) {
    await this.aplicarDelServidor(cambios);
    const cola = { ...datosVacios(), ...((await guardado.leer<DatosDeNegocio>(this.clave('cola'))) ?? {}) };
    await guardado.escribir(this.clave('cola'), fusionar(cola, cambios));
  }

  async aplicarDelServidor(cambios: CambiosDeNegocio) {
    await guardado.escribir(this.clave('datos'), fusionar(await this.leer(), cambios));
  }

  async pendientes(): Promise<CambiosDeNegocio> {
    return (await guardado.leer<CambiosDeNegocio>(this.clave('cola'))) ?? {};
  }

  async quitarPendientes() {
    await guardado.borrar(this.clave('cola'));
  }

  async marca() {
    return guardado.leer<string>(this.clave('marca'));
  }

  async guardarMarca(hasta: string) {
    await guardado.escribir(this.clave('marca'), hasta);
  }
}

export const almacenDeNegocio = (dueno: string): AlmacenLocal => new AlmacenDeNegocioWeb(dueno);
