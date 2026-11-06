import type { LineaDeCredito } from '../dominio/linea-de-credito.js';
import type { LineaDeCreditoRepositorio } from '../dominio/linea-de-credito.repositorio.js';
import { SinPermiso } from '../dominio/errores.js';

export class ConsultarCredito {
  constructor(private readonly lineas: LineaDeCreditoRepositorio) {}

  porTiendaYMayorista(tiendaId: string, mayoristaId: string): Promise<LineaDeCredito | null> {
    return this.lineas.buscar(tiendaId, mayoristaId);
  }

  porId(id: string): Promise<LineaDeCredito | null> {
    return this.lineas.buscarPorId(id);
  }

  /** Lo ve solo la tienda de la línea o el mayorista que la dio. */
  async deLaSesion(tiendaId: string, mayoristaId: string, orgId: string): Promise<LineaDeCredito | null> {
    if (!orgId || (orgId !== tiendaId && orgId !== mayoristaId)) {
      throw new SinPermiso('Solo la tienda o el mayorista pueden ver este crédito');
    }
    return this.lineas.buscar(tiendaId, mayoristaId);
  }

  delMayorista(mayoristaId: string): Promise<LineaDeCredito[]> {
    return this.lineas.delMayorista(mayoristaId);
  }
}
