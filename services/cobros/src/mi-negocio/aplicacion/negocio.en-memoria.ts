import { COLECCIONES, EDITABLES, datosVacios, type CambiosDeNegocio, type Coleccion, type DatosDeNegocio } from '../dominio/modelo.js';
import type { RepositorioDeNegocio } from '../dominio/puertos.js';

type Registro = { id: string; claveUnica?: string; actualizadoEn?: string };

/** Para las pruebas: la misma regla que el repositorio de Prisma, con un reloj que marca cuándo se recibió cada cosa */
export class NegocioEnMemoria implements RepositorioDeNegocio {
  private readonly filas = new Map<string, { registro: Registro; recibidoEn: number; coleccion: Coleccion; orgId: string }>();
  constructor(private readonly ahora: () => number = () => Date.now()) {}

  private clave(orgId: string, c: Coleccion, r: Registro) {
    const unica = (c === 'movimientos' || c === 'anotaciones') && r.claveUnica ? r.claveUnica : r.id;
    return `${orgId}|${c}|${unica}`;
  }

  async guardar(orgId: string, cambios: CambiosDeNegocio, opciones: { soloSiNoExisten?: boolean } = {}) {
    let escritos = 0;
    for (const c of COLECCIONES) {
      for (const r of (cambios[c] ?? []) as Registro[]) {
        const k = this.clave(orgId, c, r);
        // Un movimiento o una anotación también chocan por id (la tabla tiene las dos llaves)
        const choca = this.filas.get(k) ?? [...this.filas.values()].find((f) => f.orgId === orgId && f.coleccion === c && f.registro.id === r.id);
        if (!choca || (!opciones.soloSiNoExisten && EDITABLES.has(c) && (r.actualizadoEn ?? '') >= (choca.registro.actualizadoEn ?? ''))) {
          this.filas.set(k, { registro: structuredClone(r), recibidoEn: this.ahora(), coleccion: c, orgId });
          escritos++;
        }
      }
    }
    return escritos;
  }

  async desde(orgId: string, desde: Date | null): Promise<DatosDeNegocio> {
    const datos = datosVacios();
    for (const f of this.filas.values()) {
      if (f.orgId === orgId && (!desde || f.recibidoEn > desde.getTime())) (datos[f.coleccion] as Registro[]).push(structuredClone(f.registro));
    }
    return datos;
  }
}
