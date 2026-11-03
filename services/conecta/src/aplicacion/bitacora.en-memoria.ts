import type { EntradaDeBitacora } from '../dominio/bitacora.js';
import type { Bitacora } from '../dominio/puertos.js';

/** Bitácora en memoria para pruebas. */
export class BitacoraEnMemoria implements Bitacora {
  readonly entradas: EntradaDeBitacora[] = [];

  async anotar(entrada: EntradaDeBitacora) {
    this.entradas.push(entrada);
  }

  async delMayorista(mayoristaId: string, limite: number) {
    return this.entradas
      .filter((e) => e.mayoristaId === mayoristaId)
      .sort((a, b) => b.ocurridoEn.localeCompare(a.ocurridoEn))
      .slice(0, limite);
  }
}
