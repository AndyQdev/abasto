import { Injectable, signal } from '@angular/core';
import type { SesionDelShell } from './sesion';

export class ErrorGraphQL extends Error {
  constructor(
    mensaje: string,
    readonly codigo?: string,
  ) {
    super(mensaje);
  }
}

/**
 * Cliente GraphQL del Panel. Todo pasa por el Apollo Router, que junta los subgrafos de
 * Pedidos (Spring), Catálogo (Laravel) y Cobros (NestJS): una pantalla pide exactamente los campos que muestra.
 */
@Injectable({ providedIn: 'root' })
export class GraphQL {
  readonly sesion = signal<SesionDelShell | null>(null);
  private avisarSesion!: (s: SesionDelShell) => void;
  /** El Shell pasa la sesión después de crear el elemento: las vistas esperan a que llegue. */
  private readonly sesionLista = new Promise<SesionDelShell>((r) => (this.avisarSesion = r));

  fijarSesion(sesion: SesionDelShell | null) {
    this.sesion.set(sesion);
    if (sesion) this.avisarSesion(sesion);
  }

  async consultar<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const sesion = this.sesion() ?? (await this.sesionLista);
    const respuesta = await fetch(sesion.urls.router, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await sesion.token()}` },
      body: JSON.stringify({ query, variables }),
    });
    const cuerpo = (await respuesta.json()) as {
      data?: T;
      errors?: { message: string; extensions?: { code?: string } }[];
    };
    // El Router devuelve datos parciales si un subgrafo falla: se muestran y se avisa
    if (cuerpo.errors?.length && !cuerpo.data) {
      throw new ErrorGraphQL(cuerpo.errors[0].message, cuerpo.errors[0].extensions?.code);
    }
    if (cuerpo.errors?.length) console.warn('GraphQL devolvió datos parciales', cuerpo.errors);
    return cuerpo.data as T;
  }

  /** Conecta es REST (la API pública): Panel › Conecta lee su bitácora con la misma sesión. */
  async leerDeConecta<T>(ruta: string): Promise<T> {
    const sesion = this.sesion() ?? (await this.sesionLista);
    const respuesta = await fetch(`${sesion.urls.conecta}${ruta}`, { headers: { authorization: `Bearer ${await sesion.token()}` } });
    if (!respuesta.ok) throw new Error(respuesta.status === 401 ? 'Tu sesión venció: vuelve a entrar' : `Conecta respondió ${respuesta.status}`);
    return (await respuesta.json()) as T;
  }
}
