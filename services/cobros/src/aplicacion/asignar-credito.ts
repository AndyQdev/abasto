import { Dinero } from '../dominio/dinero.js';
import { SinPermiso } from '../dominio/errores.js';
import { LineaDeCredito } from '../dominio/linea-de-credito.js';
import type { LineaDeCreditoRepositorio } from '../dominio/linea-de-credito.repositorio.js';

export interface AsignarCreditoEntrada {
  tiendaId: string;
  limiteCentavos: number;
  plazoDias: number;
}

/**
 * CU-04: el mayorista de la sesión le da crédito a una tienda o cambia el que tiene.
 * El mayorista sale del token, nunca de un argumento: nadie puede dar crédito en nombre de otro.
 */
export class AsignarCredito {
  constructor(
    private readonly lineas: LineaDeCreditoRepositorio,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: AsignarCreditoEntrada, sesion: { orgId: string; roles: string[] }): Promise<LineaDeCredito> {
    if (!sesion.orgId || !sesion.roles.includes('mayorista')) {
      throw new SinPermiso('Solo un mayorista puede dar crédito');
    }
    if (entrada.tiendaId === sesion.orgId) throw new SinPermiso('No puedes darte crédito a ti mismo');
    const limite = Dinero.deCentavos(entrada.limiteCentavos);
    const existente = await this.lineas.buscar(entrada.tiendaId, sesion.orgId);
    if (existente) {
      existente.cambiar(limite, entrada.plazoDias);
      await this.lineas.guardar(existente);
      return existente;
    }
    const nueva = LineaDeCredito.abrir(this.nuevoId(), entrada.tiendaId, sesion.orgId, limite, entrada.plazoDias);
    await this.lineas.guardar(nueva);
    return nueva;
  }
}
