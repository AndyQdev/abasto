/**
 * Carga de microfrontends en tiempo de ejecución.
 * Cada remoto publica un script (ESM) que registra su Web Component. El Shell lee remotos.json,
 * importa el script la primera vez que hace falta y después solo crea el elemento.
 * Gestión (Angular) y Inteligencia (Vue) se despliegan por separado: cambiar uno no recompila el Shell.
 * El contrato entre el Shell y los remotos está en contracts/microfrontends.md.
 */
export type NombreDeRemoto = 'gestion' | 'inteligencia';

export interface DefinicionDeRemoto {
  elemento: string;
  scripts: string[];
}

export type Manifiesto = Record<NombreDeRemoto, DefinicionDeRemoto>;

type Importar = (url: string) => Promise<unknown>;

const importarModulo: Importar = (url) => import(/* @vite-ignore */ url);

export class CargadorDeRemotos {
  private manifiesto?: Promise<Manifiesto>;
  private readonly cargas = new Map<NombreDeRemoto, Promise<string>>();
  private readonly leerManifiesto: () => Promise<Manifiesto>;
  private readonly importar: Importar;
  private readonly registro: Pick<CustomElementRegistry, 'whenDefined'>;

  constructor(
    leerManifiesto: () => Promise<Manifiesto> = async () => (await fetch('/remotos.json')).json() as Promise<Manifiesto>,
    importar: Importar = importarModulo,
    registro: Pick<CustomElementRegistry, 'whenDefined'> = customElements,
  ) {
    this.leerManifiesto = leerManifiesto;
    this.importar = importar;
    this.registro = registro;
  }

  /** Devuelve el nombre del elemento cuando ya está registrado. Cada remoto se carga una sola vez. */
  cargar(nombre: NombreDeRemoto): Promise<string> {
    let carga = this.cargas.get(nombre);
    if (!carga) {
      carga = this.cargarUnaVez(nombre);
      this.cargas.set(nombre, carga);
      carga.catch(() => this.cargas.delete(nombre)); // si falló, el próximo intento vuelve a probar
    }
    return carga;
  }

  private async cargarUnaVez(nombre: NombreDeRemoto): Promise<string> {
    this.manifiesto ??= this.leerManifiesto();
    const definicion = (await this.manifiesto)[nombre];
    if (!definicion) throw new Error(`remotos.json no define el remoto ${nombre}`);
    for (const script of definicion.scripts) await this.importar(script);
    await this.registro.whenDefined(definicion.elemento);
    return definicion.elemento;
  }
}

export const remotos = new CargadorDeRemotos();
