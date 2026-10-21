import type { LineaDeCredito } from '../dominio/linea-de-credito.js';
import type { LineaDeCreditoRepositorio } from '../dominio/linea-de-credito.repositorio.js';

export class ConsultarCredito {
  constructor(private readonly lineas: LineaDeCreditoRepositorio) {}

  porTiendaYMayorista(tiendaId: string, mayoristaId: string): Promise<LineaDeCredito | null> {
    return this.lineas.buscar(tiendaId, mayoristaId);
  }

  porId(id: string): Promise<LineaDeCredito | null> {
    return this.lineas.buscarPorId(id);
  }
}
