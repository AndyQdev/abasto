import { LineaDeCredito } from '../dominio/linea-de-credito.js';
import type { LineaDeCreditoRepositorio } from '../dominio/linea-de-credito.repositorio.js';
import type { EventoDeCobros } from '../dominio/eventos.js';

/** Repositorio en memoria para las pruebas de los casos de uso. No se usa en producción. */
export class LineaDeCreditoEnMemoria implements LineaDeCreditoRepositorio {
  readonly outbox: EventoDeCobros[] = [];
  private readonly lineas = new Map<string, LineaDeCredito>();

  constructor(iniciales: LineaDeCredito[] = []) {
    for (const linea of iniciales) this.lineas.set(linea.id, linea);
  }

  async buscar(tiendaId: string, mayoristaId: string) {
    for (const linea of this.lineas.values()) {
      if (linea.tiendaId === tiendaId && linea.mayoristaId === mayoristaId) return linea;
    }
    return null;
  }

  async buscarPorId(id: string) {
    return this.lineas.get(id) ?? null;
  }

  async guardar(linea: LineaDeCredito) {
    this.outbox.push(...linea.sacarEventos());
    this.lineas.set(linea.id, linea);
  }
}
