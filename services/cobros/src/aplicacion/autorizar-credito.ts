import { Dinero } from '../dominio/dinero.js';
import { LineaDeCreditoNoExiste } from '../dominio/errores.js';
import type { LineaDeCreditoRepositorio } from '../dominio/linea-de-credito.repositorio.js';

export interface AutorizarCreditoEntrada {
  tiendaId: string;
  mayoristaId: string;
  pedidoId: string;
  centavos: number;
}

export interface ResultadoCredito {
  lineaId: string;
  pedidoId: string;
  autorizado: Dinero;
  disponible: Dinero;
}

/** Caso de uso del paso 3 de la saga de compra: descontar el pedido del cupo de crédito. */
export class AutorizarCredito {
  constructor(private readonly lineas: LineaDeCreditoRepositorio) {}

  async ejecutar(entrada: AutorizarCreditoEntrada): Promise<ResultadoCredito> {
    const linea = await this.lineas.buscar(entrada.tiendaId, entrada.mayoristaId);
    if (!linea) throw new LineaDeCreditoNoExiste(entrada.tiendaId, entrada.mayoristaId);

    const monto = Dinero.deCentavos(entrada.centavos);
    linea.autorizar(entrada.pedidoId, monto);
    await this.lineas.guardar(linea);

    return {
      lineaId: linea.id,
      pedidoId: entrada.pedidoId,
      autorizado: monto,
      disponible: linea.disponible,
    };
  }
}

/** Compensación: si el mayorista rechaza o la saga falla después, se devuelve el cupo. */
export class LiberarCredito {
  constructor(private readonly lineas: LineaDeCreditoRepositorio) {}

  async ejecutar(entrada: Omit<AutorizarCreditoEntrada, 'centavos'>): Promise<void> {
    const linea = await this.lineas.buscar(entrada.tiendaId, entrada.mayoristaId);
    if (!linea) return;
    linea.liberar(entrada.pedidoId);
    await this.lineas.guardar(linea);
  }
}
