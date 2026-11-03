import { AlmacenEnMemoria, fusionar, datosVacios, COLECCIONES, claveDe, type AlmacenDeNegocio, type CambiosDeNegocio, type Coleccion, type DatosDeNegocio } from '@abasto/comercio';

/**
 * Lo que el teléfono necesita además de leer y guardar: la cola de lo que falta subir y la marca de la última bajada.
 * Lo implementan SQLite (`almacen-negocio.ts`), la vista web (`almacen-negocio.web.ts`) y la memoria (pruebas).
 */
export interface AlmacenLocal extends AlmacenDeNegocio {
  /** Lo que baja del servidor: se guarda sin volver a la cola */
  aplicarDelServidor(cambios: CambiosDeNegocio): Promise<void>;
  pendientes(): Promise<CambiosDeNegocio>;
  quitarPendientes(subidos: CambiosDeNegocio): Promise<void>;
  marca(): Promise<string | null>;
  guardarMarca(hasta: string): Promise<void>;
}

/** Los registros guardados antes de un campo nuevo se completan al leerlos (los artículos de la Fase 2) */
export function normalizar(c: Coleccion, r: Record<string, unknown>) {
  if (c === 'articulos') {
    return { precioVentaCentavos: null, stockMinimo: null, eliminado: false, actualizadoEn: (r.creadoEn as string) ?? '', ...r };
  }
  return r;
}

/** Para las pruebas: como el de SQLite, pero en memoria */
export class AlmacenLocalEnMemoria extends AlmacenEnMemoria implements AlmacenLocal {
  private cola: DatosDeNegocio = datosVacios();
  private hasta: string | null = null;

  async guardar(cambios: CambiosDeNegocio) {
    await super.guardar(cambios);
    this.cola = fusionar(this.cola, cambios);
  }

  async aplicarDelServidor(cambios: CambiosDeNegocio) {
    await super.guardar(cambios);
  }

  async pendientes(): Promise<CambiosDeNegocio> {
    const c: CambiosDeNegocio = {};
    for (const k of COLECCIONES) if (this.cola[k].length) (c as Record<Coleccion, unknown[]>)[k] = this.cola[k];
    return c;
  }

  async quitarPendientes(subidos: CambiosDeNegocio) {
    for (const k of COLECCIONES) {
      const fuera = new Set((subidos[k] ?? []).map((r) => JSON.stringify(r)));
      const claves = new Set((subidos[k] ?? []).map((r) => claveDe(k, r as { id: string })));
      (this.cola as Record<Coleccion, unknown[]>)[k] = (this.cola[k] as { id: string }[]).filter((r) => !(claves.has(claveDe(k, r)) && fuera.has(JSON.stringify(r))));
    }
  }

  async marca() {
    return this.hasta;
  }

  async guardarMarca(hasta: string) {
    this.hasta = hasta;
  }
}
